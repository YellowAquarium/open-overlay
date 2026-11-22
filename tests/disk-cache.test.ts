import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// @ts-ignore - plain JS module shipped next to proxy.js
import { DiskCache } from '../disk-cache.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'open-overlay-cache-'));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('stores entries, survives a restart and evicts least recently used tiles over the limit', async () => {
  const dir = tempDir();
  const body = Buffer.alloc(10_000, 7);
  const cache = new DiskCache({ dir, maxBytes: 200_000, name: 'test' });
  await cache.set('a', { status: 200, contentType: 'application/x-protobuf', body });
  const hit = await cache.get('a');
  assert.equal(hit.status, 200);
  assert.equal(hit.contentType, 'application/x-protobuf');
  assert.deepEqual(hit.body, body);
  assert.equal(await cache.get('missing'), null);

  // Fill well past the limit.
  for (let i = 0; i < 60; i += 1) await cache.set(`tile-${i}`, { status: 200, contentType: 'x', body });
  await cache.evict();
  assert.ok(cache.totalBytes <= 200_000, `cache is ${cache.totalBytes} bytes`);
  // The newest tile is still there.
  assert.ok(await cache.get('tile-59'));
  cache.close();

  // Index is persisted: a new instance knows the size without scanning.
  const reopened = new DiskCache({ dir, maxBytes: 200_000, name: 'test' });
  assert.equal(reopened.ready, true);
  assert.equal(reopened.totalBytes, cache.totalBytes);
  await reopened.clear();
  assert.equal(reopened.totalBytes, 0);
  assert.equal(await reopened.get('tile-59'), null);
  reopened.close();
});

test('rebuilds a missing index from the files on disk', async () => {
  const dir = tempDir();
  const cache = new DiskCache({ dir, maxBytes: 10_000_000, name: 'test' });
  for (let i = 0; i < 5; i += 1) await cache.set(`k${i}`, { status: 204, contentType: '', body: Buffer.alloc(0) });
  const size = cache.totalBytes;
  cache.close();
  fs.rmSync(path.join(dir, 'index.json'));
  const rebuilt = new DiskCache({ dir, maxBytes: 10_000_000, name: 'test' });
  for (let i = 0; i < 50 && !rebuilt.ready; i += 1) await wait(20);
  assert.equal(rebuilt.totalBytes, size);
  assert.equal(rebuilt.totalFiles, 5);
  assert.equal((await rebuilt.get('k3')).status, 204);
  rebuilt.close();
});

test('the proxy keeps railway tiles on disk and serves them when openrailwaymap.app is unreachable', async () => {
  const cacheDir = tempDir();
  const UPSTREAM_PORT = 18931;
  let upstreamHits = 0;
  const upstream = http.createServer((req, res) => {
    upstreamHits += 1;
    if (!req.headers.referer) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/x-protobuf' });
    res.end(Buffer.from([9, 8, 7]));
  });
  await new Promise<void>((resolve) => upstream.listen(UPSTREAM_PORT, '127.0.0.1', resolve));

  const start = (port: number): Promise<ChildProcess> => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'proxy.js')], {
      cwd: root,
      env: { ...process.env, PROXY_PORT: String(port), ORM_UPSTREAM: `http://127.0.0.1:${UPSTREAM_PORT}`, OPEN_OVERLAY_CACHE_DIR: cacheDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout!.on('data', (chunk) => { if (String(chunk).includes('listening')) resolve(child); });
    child.on('exit', (code) => reject(new Error(`proxy exited ${code}`)));
  });

  const first = await start(18932);
  const tileUrl = (port: number) => `http://127.0.0.1:${port}/orm/tiles/railway_line_high,railway_text_km/14/1/2`;
  try {
    assert.deepEqual([...new Uint8Array(await (await fetch(tileUrl(18932))).arrayBuffer())], [9, 8, 7]);
    await wait(300);
    const health = await (await fetch('http://127.0.0.1:18932/health')).json();
    assert.ok(health.diskCache.openrailwaymap.bytes > 0);
    assert.equal(health.diskCache.openrailwaymap.maxBytes, 25 * 1024 ** 3);
    assert.equal(health.diskCache['google-keyless'].maxBytes, 50 * 1024 ** 3);
    // Websites may not clear the cache.
    const blocked = await fetch('http://127.0.0.1:18932/cache/all', { method: 'DELETE', headers: { origin: 'https://evil.example' } });
    assert.equal(blocked.status, 403);
  } finally {
    first.kill('SIGTERM');
    await wait(300);
  }

  // Upstream goes away; a new proxy still serves the stored tile.
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
  const second = await start(18933);
  try {
    const hitsBefore = upstreamHits;
    const response = await fetch(tileUrl(18933));
    assert.equal(response.status, 200);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [9, 8, 7]);
    assert.equal(upstreamHits, hitsBefore);
    // The game (Origin "null") can clear it.
    const cleared = await fetch('http://127.0.0.1:18933/cache/openrailwaymap', { method: 'DELETE', headers: { origin: 'null' } });
    assert.equal(cleared.status, 202);
    await wait(300);
    const after = await (await fetch('http://127.0.0.1:18933/health')).json();
    assert.equal(after.diskCache.openrailwaymap.bytes, 0);
  } finally {
    second.kill('SIGTERM');
  }
});
