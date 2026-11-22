/**
 * Open Overlay - persistent tile cache on disk (used by proxy.js).
 *
 * Each entry is one file: a 4-byte header length, a small JSON header (status, content type,
 * when it was stored) and the raw body. Files live in <dir>/<aa>/<bb>/<sha1-of-key>, i.e. 256
 * "shards" (aa) of 256 folders each, so no folder gets huge even with millions of tiles.
 *
 * Size accounting is kept per shard in <dir>/index.json (saved every 30 s and on exit), so
 * start-up doesn't have to read millions of files. When the cache goes over its limit, the
 * largest shard is scanned and its least recently used files (by modification time, which is
 * refreshed when a tile is read) are deleted. If index.json is missing or damaged, it is
 * rebuilt in the background.
 *
 * Zero dependencies.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const SHARDS = 256;
const INDEX_SAVE_MS = 30000;
const TOUCH_AFTER_MS = 24 * 60 * 60 * 1000;   // refresh "last used" at most once a day per file
const EVICT_TARGET = 0.95;                     // evict down to 95% of the limit
const EXACT_LRU_MAX_FILES = 50000;             // small caches: scan everything for exact LRU
const SAMPLE_SHARDS = 16;                      // big caches: look at the 16 fullest shards per round
const MIN_FREE_DISK_BYTES = 2 * 1024 ** 3;     // never fill the drive: keep 2 GB free

export class DiskCache {
  /**
   * @param {{ dir: string, maxBytes: number, name: string, log?: (message: string) => void }} options
   */
  constructor({ dir, maxBytes, name, log }) {
    this.dir = dir;
    this.maxBytes = maxBytes;
    this.name = name;
    this.log = log || (() => {});
    this.shardBytes = new Array(SHARDS).fill(0);
    this.shardFiles = new Array(SHARDS).fill(0);
    this.ready = false;
    this.evicting = null;
    this.clearing = null;
    this.indexDirty = false;
    this.writesSinceSpaceCheck = Infinity;
    this.touched = new Set();
    this.diskFull = false;
    this.disabled = maxBytes <= 0;
    if (this.disabled) return;

    fs.mkdirSync(dir, { recursive: true });
    const hasTiles = fs.readdirSync(dir).some((entry) => /^[0-9a-f]{2}$/.test(entry));
    if (!hasTiles) {
      // Brand-new (or emptied) cache: nothing to count.
      this.ready = true;
    } else if (!this.loadIndex()) {
      this.log(`${name} disk cache: building its index in the background...`);
      void this.rebuildIndex();
    } else {
      this.ready = true;
    }
    this.indexTimer = setInterval(() => this.saveIndex(), INDEX_SAVE_MS);
    this.indexTimer.unref?.();
  }

  get totalBytes() {
    return this.shardBytes.reduce((sum, value) => sum + value, 0);
  }

  get totalFiles() {
    return this.shardFiles.reduce((sum, value) => sum + value, 0);
  }

  stats() {
    return {
      dir: this.dir,
      bytes: this.totalBytes,
      files: this.totalFiles,
      maxBytes: this.maxBytes,
      ready: this.ready,
      clearing: Boolean(this.clearing),
      diskFull: this.diskFull,
      enabled: !this.disabled,
    };
  }

  /** @returns {Promise<{status:number, contentType:string, storedAt:number, body:Buffer} | null>} */
  async get(key) {
    if (this.disabled || this.clearing) return null;
    const file = this.fileFor(key);
    let data;
    try {
      data = await fsp.readFile(file);
    } catch {
      return null;
    }
    const entry = decodeEntry(data);
    if (!entry || entry.key !== key) return null;
    // Mark as recently used for eviction (at most once per file per session, and only once
    // the file is a day old, to keep disk writes down).
    if (Date.now() - entry.storedAt > TOUCH_AFTER_MS && !this.touched.has(file)) {
      if (this.touched.size > 200000) this.touched.clear();
      this.touched.add(file);
      const now = new Date();
      fsp.utimes(file, now, now).catch(() => {});
    }
    return entry;
  }

  /** Stores a response. Never throws; caching is best-effort. */
  async set(key, { status, contentType, body }) {
    if (this.disabled || this.clearing || this.diskFull) return;
    if (body.length > 32 * 1024 * 1024) return;
    try {
      await this.checkFreeSpace();
      if (this.diskFull) return;
      const file = this.fileFor(key);
      const shard = shardOf(file);
      const encoded = encodeEntry({ key, status, contentType, storedAt: Date.now() }, body);
      let previous = 0;
      try {
        previous = (await fsp.stat(file)).size;
      } catch {
        // new entry
      }
      await fsp.mkdir(path.dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      await fsp.writeFile(temp, encoded);
      await fsp.rename(temp, file);
      this.shardBytes[shard] += encoded.length - previous;
      if (!previous) this.shardFiles[shard] += 1;
      this.indexDirty = true;
      if (this.ready && this.totalBytes > this.maxBytes) void this.evict();
    } catch (error) {
      this.log(`${this.name} disk cache: could not save a tile (${error.code || error.message})`);
    }
  }

  /** Deletes everything (runs in the background; returns at once). */
  clear() {
    if (this.disabled) return;
    if (this.clearing) return this.clearing;
    const started = Date.now();
    this.clearing = (async () => {
      const shards = await fsp.readdir(this.dir).catch(() => []);
      for (const entry of shards) {
        if (!/^[0-9a-f]{2}$/.test(entry)) continue;
        await fsp.rm(path.join(this.dir, entry), { recursive: true, force: true }).catch(() => {});
      }
      this.shardBytes.fill(0);
      this.shardFiles.fill(0);
      this.indexDirty = true;
      this.saveIndex();
      this.log(`${this.name} disk cache cleared (${Math.round((Date.now() - started) / 1000)} s).`);
    })().finally(() => {
      this.clearing = null;
    });
    return this.clearing;
  }

  close() {
    if (this.disabled) return;
    clearInterval(this.indexTimer);
    this.saveIndex();
  }

  // ------------------------------------------------------------------------

  fileFor(key) {
    const hash = crypto.createHash('sha1').update(key).digest('hex');
    return path.join(this.dir, hash.slice(0, 2), hash.slice(2, 4), hash);
  }

  indexPath() {
    return path.join(this.dir, 'index.json');
  }

  loadIndex() {
    try {
      const index = JSON.parse(fs.readFileSync(this.indexPath(), 'utf8'));
      if (index.version !== 1 || !Array.isArray(index.shardBytes) || index.shardBytes.length !== SHARDS) return false;
      this.shardBytes = index.shardBytes.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
      this.shardFiles = (Array.isArray(index.shardFiles) && index.shardFiles.length === SHARDS ? index.shardFiles : new Array(SHARDS).fill(0))
        .map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
      return true;
    } catch {
      return false;
    }
  }

  saveIndex() {
    if (this.disabled || !this.indexDirty || !this.ready) return;
    try {
      const temp = `${this.indexPath()}.tmp`;
      fs.writeFileSync(temp, JSON.stringify({ version: 1, shardBytes: this.shardBytes, shardFiles: this.shardFiles, savedAt: new Date().toISOString() }));
      fs.renameSync(temp, this.indexPath());
      this.indexDirty = false;
    } catch {
      // try again next time
    }
  }

  async rebuildIndex() {
    const bytes = new Array(SHARDS).fill(0);
    const files = new Array(SHARDS).fill(0);
    for (let shard = 0; shard < SHARDS; shard += 1) {
      const result = await this.scanShard(shard);
      bytes[shard] = result.bytes;
      files[shard] = result.entries.length;
    }
    this.shardBytes = bytes;
    this.shardFiles = files;
    this.ready = true;
    this.indexDirty = true;
    this.saveIndex();
    this.log(`${this.name} disk cache: ${formatBytes(this.totalBytes)} in ${this.totalFiles} tiles.`);
    if (this.totalBytes > this.maxBytes) void this.evict();
  }

  /** Lists one shard's files with size and last-used time (and removes leftover temp files). */
  async scanShard(shard) {
    const shardDir = path.join(this.dir, shard.toString(16).padStart(2, '0'));
    const entries = [];
    let bytes = 0;
    const subdirs = await fsp.readdir(shardDir).catch(() => []);
    for (const sub of subdirs) {
      const subDir = path.join(shardDir, sub);
      const names = await fsp.readdir(subDir).catch(() => []);
      for (const name of names) {
        const file = path.join(subDir, name);
        try {
          const stat = await fsp.stat(file);
          if (name.endsWith('.tmp')) {
            if (Date.now() - stat.mtimeMs > 60000) await fsp.rm(file, { force: true });
            continue;
          }
          entries.push({ file, size: stat.size, usedAt: stat.mtimeMs });
          bytes += stat.size;
        } catch {
          // vanished
        }
      }
    }
    return { entries, bytes };
  }

  /**
   * Deletes least recently used tiles until the cache is back under its limit.
   * Small caches are scanned completely (exact LRU). Big caches (millions of files) look at the
   * fullest shards each round; tiles are spread evenly by hash, so this closely approximates
   * global LRU without reading every file.
   */
  evict() {
    if (this.evicting) return this.evicting;
    this.evicting = (async () => {
      const target = this.maxBytes * EVICT_TARGET;
      let rounds = 0;
      while (this.totalBytes > target && rounds < 64) {
        rounds += 1;
        const shards = this.totalFiles <= EXACT_LRU_MAX_FILES
          ? [...Array(SHARDS).keys()]
          : [...Array(SHARDS).keys()].sort((a, b) => this.shardBytes[b] - this.shardBytes[a]).slice(0, SAMPLE_SHARDS);
        const candidates = [];
        let scannedBytes = 0;
        for (const shard of shards) {
          const { entries, bytes } = await this.scanShard(shard);
          // Re-sync the counters with what is really on disk.
          this.shardBytes[shard] = bytes;
          this.shardFiles[shard] = entries.length;
          scannedBytes += bytes;
          for (const entry of entries) candidates.push({ ...entry, shard });
        }
        if (!candidates.length) break;
        candidates.sort((a, b) => a.usedAt - b.usedAt);
        // Free what's needed, but at least a slice of the sample so we don't evict one file at a time.
        let toFree = Math.max(this.totalBytes - target, Math.min(scannedBytes * 0.1, this.maxBytes * 0.01));
        for (const entry of candidates) {
          if (toFree <= 0) break;
          try {
            await fsp.rm(entry.file, { force: true });
            this.shardBytes[entry.shard] -= entry.size;
            this.shardFiles[entry.shard] -= 1;
            toFree -= entry.size;
          } catch {
            // ignore
          }
        }
        this.indexDirty = true;
      }
      this.saveIndex();
    })().finally(() => {
      this.evicting = null;
    });
    return this.evicting;
  }

  async checkFreeSpace() {
    // Checking the drive on every write is wasteful; every 200 writes is plenty.
    this.writesSinceSpaceCheck += 1;
    if (this.writesSinceSpaceCheck < 200) return;
    this.writesSinceSpaceCheck = 0;
    if (typeof fsp.statfs !== 'function') return;
    try {
      const info = await fsp.statfs(this.dir);
      const free = Number(info.bavail) * Number(info.bsize);
      const wasFull = this.diskFull;
      this.diskFull = free < MIN_FREE_DISK_BYTES;
      if (this.diskFull && !wasFull) this.log(`${this.name} disk cache paused: less than 2 GB free on the drive.`);
      if (!this.diskFull && wasFull) this.log(`${this.name} disk cache resumed.`);
    } catch {
      // ignore
    }
  }
}

function shardOf(file) {
  return Number.parseInt(path.basename(file).slice(0, 2), 16);
}

function encodeEntry(meta, body) {
  const header = Buffer.from(JSON.stringify(meta), 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length, 0);
  return Buffer.concat([length, header, body]);
}

function decodeEntry(data) {
  try {
    if (data.length < 4) return null;
    const headerLength = data.readUInt32BE(0);
    if (headerLength > 64 * 1024 || 4 + headerLength > data.length) return null;
    const meta = JSON.parse(data.subarray(4, 4 + headerLength).toString('utf8'));
    return {
      key: meta.key,
      status: meta.status,
      contentType: meta.contentType || '',
      storedAt: meta.storedAt || 0,
      body: data.subarray(4 + headerLength),
    };
  } catch {
    return null;
  }
}

export function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Default cache location: outside the game's mods folder, in the user's cache directory. */
export function defaultCacheDir() {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'OpenOverlay', 'cache');
  }
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Caches', 'OpenOverlay');
  return path.join(process.env.XDG_CACHE_HOME || path.join(home, '.cache'), 'open-overlay');
}
