#!/usr/bin/env node
/**
 * Open Overlay - local streaming proxy
 *
 * Streams OpenRailwayMap vector data from https://openrailwaymap.app into
 * Subway Builder. The game only talks to this proxy on localhost; the proxy
 * fetches the style, TileJSON, vector tiles, sprites and API responses on
 * demand (only for the area you are looking at), keeps a small in-memory
 * cache and rewrites every URL so MapLibre loads everything through here.
 *
 * Zero dependencies - needs Node.js 18 or newer.
 */
import http from 'node:http';
import fs from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DiskCache, defaultCacheDir, formatBytes } from './disk-cache.js';
import { mltToMvt, looksLikeMvt, composeTile, summarizeMvt } from './mlt-convert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotEnv(path.join(__dirname, '.env'));

const VERSION = readManifestVersion();

// --- Run alongside the game -------------------------------------------------
// --game-pid <pid>  stop when that process (the game) exits (used by the Steam launch option)
// --with-game       stop when no Subway Builder process is running any more
// --launch-game     also start Subway Builder (via Steam, or SUBWAY_BUILDER_EXE from .env)
const CLI_ARGS = process.argv.slice(2);
const GAME_PID = parsePidArg(CLI_ARGS);
const LAUNCH_GAME = CLI_ARGS.includes('--launch-game');
const FOLLOW_GAME = CLI_ARGS.includes('--with-game') || LAUNCH_GAME || GAME_PID !== null;
const STEAM_APP_ID = '4039140';
const GAME_PROCESS_MATCH = new RegExp(process.env.GAME_PROCESS_MATCH || 'subway.?builder|metro.?maker', 'i');
// The game's program file name, when known: passed by the launcher (--game-exe), taken from
// SUBWAY_BUILDER_EXE, or discovered from the install folder (see discoverGameExe).
let gameExeName = exeNameOf(parseStringArg(CLI_ARGS, '--game-exe') || process.env.SUBWAY_BUILDER_EXE || '');
// Folder name that identifies the game install when looking processes up by path.
const GAME_FOLDER_MATCH = process.env.GAME_FOLDER_MATCH || 'Subway Builder';
const GAME_CHECK_INTERVAL_MS = envMs('GAME_CHECK_INTERVAL_MS', 5000);
const GAME_START_TIMEOUT_MS = envMs('GAME_START_TIMEOUT_MS', 10 * 60 * 1000); // time for Steam / updates to start the game
const GAME_RESTART_GRACE_MS = envMs('GAME_RESTART_GRACE_MS', 30000);          // the game may relaunch itself (mod changes)
// The mod's heartbeat counts as "game open" for this long. Generous, because the game can freeze
// its scripts for minutes while loading a big city.
const GAME_QUIET_MS = envMs('GAME_QUIET_MS', 10 * 60 * 1000);
const IDLE_FALLBACK_MS = envMs('IDLE_FALLBACK_MS', 30 * 60 * 1000);           // if process detection is unavailable
const LOG_PATH = path.join(__dirname, 'logs', 'proxy.log');
const LOG_MAX_BYTES = 1024 * 1024;
// Diagnostics: one line per railway tile served, plus the mod's reports of what the map did with them.
const TILE_LOG_PATH = path.join(__dirname, 'logs', 'tiles.log');
const TILE_LOG_MAX_BYTES = 8 * 1024 * 1024;
const TILE_LOG = process.env.TILE_LOG !== '0';
// Bumped when the tiles the proxy sends change format, so the game's own browser cache can't keep
// showing tiles from an older version.
const TILE_URL_VERSION = '3';
prepareLogFile();
let lastRequestAt = 0;
const PORT = Number.parseInt(process.env.PROXY_PORT || '8788', 10);
const HOST = process.env.PROXY_HOST || '127.0.0.1';
const STATUS_PORT = Number.parseInt(process.env.PROXY_STATUS_PORT || String(PORT + 1), 10);
const UPSTREAM = (process.env.ORM_UPSTREAM || 'https://openrailwaymap.app').replace(/\/+$/, '');
// OpenRailwayMap's usage policy requires an honest User-Agent for non-browser clients.
// OpenStreetMap's tile policy also asks for a way to contact the app's maintainer.
// Set ORM_CONTACT in .env (e.g. an email address or project page) to include it.
const CONTACT = process.env.ORM_CONTACT || '';
const USER_AGENT = process.env.ORM_USER_AGENT ||
  `SubwayBuilder-OpenOverlay/${VERSION} (Subway Builder game mod; local tile proxy${CONTACT ? `; contact: ${CONTACT}` : ''})`;
// openrailwaymap.app rejects tile, TileJSON and sprite requests that carry no Referer (HTTP 403).
// Its usage policy asks browser-style applications to send a real, non-faked Referer, so this
// identifies the page where the overlay is published. Change it in .env if you host the mod elsewhere.
const REFERER = process.env.ORM_REFERER || 'https://github.com/YellowAquarium/open-overlay';
const CACHE_MB = clampNumber(Number.parseInt(process.env.ORM_CACHE_MB || '256', 10), 16, 4096, 256);
const MAX_CONCURRENT_UPSTREAM = clampNumber(Number.parseInt(process.env.ORM_MAX_CONCURRENT || '12', 10), 1, 32, 12);
// How long a tile may take before the game gets a stand-in built from saved tiles of other zoom
// levels; the real tile replaces it once it arrives (the mod asks the game to reload it).
const STANDIN_AFTER_MS = envMs('STANDIN_AFTER_MS', 800);
// --- Disk cache (keeps streamed tiles between sessions) -----------------------
// Kept outside the game's mods folder (e.g. %LOCALAPPDATA%\OpenOverlay\cache), so the game's mod scan
// never has to look through it and updating the mod doesn't delete it.
const DISK_CACHE_DIR = process.env.OPEN_OVERLAY_CACHE_DIR || defaultCacheDir();
const ORM_DISK_CACHE_GB = envGb('ORM_DISK_CACHE_GB', 25);
const GOOGLE_KEYLESS_DISK_CACHE_GB = envGb('GOOGLE_KEYLESS_DISK_CACHE_GB', 50);
// Railway data changes upstream (OpenRailwayMap refreshes roughly daily), so stored tiles are
// re-checked after this many days; until then, and whenever openrailwaymap.app can't be
// reached, the stored copy is used.
const ORM_DISK_REFRESH_DAYS = envDays('ORM_DISK_REFRESH_DAYS', 7);
// 0 = keep using stored Google tiles until they are evicted to make room.
const GOOGLE_KEYLESS_REFRESH_DAYS = envDays('GOOGLE_KEYLESS_REFRESH_DAYS', 0);
const SATELLITE_CACHE_MB = clampNumber(Number.parseInt(process.env.SATELLITE_CACHE_MB || '256', 10), 16, 4096, 256);
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
// Give up on a slow upstream after 25 s (freshly made tiles can take a while on a busy server);
// a saved copy is served instead when there is one.
const UPSTREAM_TIMEOUT_MS = 25000;

/**
 * Satellite / base imagery providers. All go through this proxy so the game needs no direct
 * internet access. Providers that need a key only show as available once the key is in .env.
 */
const SATELLITE_PROVIDERS = [
  // Keyless Google tiles, as in Orbital Surveyor. These use Google's public web-map tile servers
  // directly rather than the official Map Tiles API, which Google's Maps terms do not permit;
  // Google may throttle or block them at any time. Requests are sent with this proxy's honest
  // User-Agent (no browser impersonation). Use the "Google Satellite (Map Tiles API)" option for
  // the sanctioned route.
  {
    id: 'google-sat',
    label: 'Google Satellite (no key, unofficial)',
    attribution: 'Imagery © Google',
    tileSize: 256,
    maxZoom: 20,
    keylessGoogle: true,
    url: (z, x, y) => googleWebTileUrl('s', z, x, y),
  },
  {
    id: 'google-hybrid',
    label: 'Google Hybrid (no key, unofficial)',
    attribution: 'Imagery © Google, map data © Google',
    tileSize: 256,
    maxZoom: 20,
    keylessGoogle: true,
    url: (z, x, y) => googleWebTileUrl('y', z, x, y),
  },
  {
    id: 'osm',
    label: 'OpenStreetMap (street map)',
    attribution: '© OpenStreetMap contributors',
    tileSize: 256,
    maxZoom: 19,
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  },
  {
    id: 'google',
    label: 'Google Satellite (Map Tiles API)',
    // Google requires the "Google Maps" mark plus the copyright text for the area on screen;
    // the mod fetches that text from /sat/google/viewport.
    attribution: 'Google Maps',
    dynamicAttribution: true,
    // Google says caching must follow the Cache-Control headers it sends with each tile.
    respectUpstreamCache: true,
    tileSize: 256,
    maxZoom: 21,
    requires: 'GOOGLE_MAPS_API_KEY',
    configured: () => Boolean(GOOGLE_MAPS_API_KEY),
    url: async (z, x, y) => `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(await getGoogleSession())}&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`,
  },
];
const SATELLITE_PATH = /^\/sat\/([a-z0-9-]+)\/(\d{1,2})\/(\d{1,8})\/(\d{1,8})$/;
let googleSession = null;

const TTL = {
  style: 60 * 60 * 1000,        // 1 h
  tilejson: 60 * 60 * 1000,     // 1 h
  sprite: 24 * 60 * 60 * 1000,  // 1 day
  tile: 6 * 60 * 60 * 1000,     // 6 h (data is refreshed upstream roughly daily)
  api: 10 * 60 * 1000,          // 10 min
  satellite: 24 * 60 * 60 * 1000, // 1 day
  error: 30 * 1000,             // retry failed fetches after 30 s
};
const CLIENT_CACHE_CONTROL = {
  style: 'no-cache',
  tilejson: 'no-cache',
  sprite: 'public, max-age=86400, stale-if-error=604800',
  tile: 'public, max-age=21600, stale-if-error=604800',
  api: 'public, max-age=600',
  satellite: 'public, max-age=604800, stale-if-error=2592000',
};

// Only these Martin function sources are published by openrailwaymap.app (mirrors its nginx allow-list).
const TILE_SOURCE_NAME = /^[a-z0-9_]+(?:,[a-z0-9_]+)*$/;
const SPRITE_PATH = /^\/orm\/sprite\/(sprite|sdf_sprite)\/symbols(@2x)?\.(json|png)$/;
const TILE_PATH = /^\/orm\/tiles\/([a-z0-9_,]+)\/(\d{1,2})\/(\d{1,8})\/(\d{1,8})$/;
const TILEJSON_PATH = /^\/orm\/tilejson\/([a-z0-9_,]+)$/;
const API_PATHS = [
  /^\/orm\/api\/route\/\d+$/,
  /^\/orm\/api\/route\/stops\/\d+$/,
  /^\/orm\/api\/feature\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.:-]+$/,
  /^\/orm\/api\/facility$/,
  /^\/orm\/api\/milestone$/,
  /^\/orm\/api\/replication_timestamp$/,
];
const API_QUERY_KEYS = new Set(['q', 'name', 'ref', 'lang', 'limit', 'position']);

const startedAt = Date.now();
const cache = new LruCache(CACHE_MB * 1024 * 1024);
const satelliteCache = new LruCache(SATELLITE_CACHE_MB * 1024 * 1024);
const ormDisk = new DiskCache({
  dir: path.join(DISK_CACHE_DIR, 'openrailwaymap'),
  maxBytes: Math.round(ORM_DISK_CACHE_GB * 1024 ** 3),
  name: 'OpenRailwayMap',
  log,
});
const googleKeylessDisk = new DiskCache({
  dir: path.join(DISK_CACHE_DIR, 'google-keyless'),
  maxBytes: Math.round(GOOGLE_KEYLESS_DISK_CACHE_GB * 1024 ** 3),
  name: 'Google (keyless)',
  log,
});
const DISK_CACHES = { openrailwaymap: ormDisk, 'google-keyless': googleKeylessDisk };
const inflight = new Map();
const upstreamQueue = [];
let upstreamActive = 0;
const failureCounts = new Map();
let failureFlushTimer = null;
const upstreamState = { lastSuccessAt: null, lastFailureAt: null, lastFailure: null, requests: 0 };

const requestHandler = (request, response) => {
  handleRequest(request, response).catch((error) => {
    log(`Unhandled error for ${request.url}: ${formatError(error)}`);
    if (!response.headersSent) sendJson(response, 500, { error: 'proxy_error', message: String(error?.message || error) });
    else response.destroy(error);
  });
};
const server = http.createServer(requestHandler);
// A second port just for the mod's status checks and heartbeat. The game allows only 6 open
// connections per address; when tile downloads are slow they can fill all 6 on the main port,
// and a status check stuck behind them would wrongly look like "proxy not running".
const statusServer = http.createServer(requestHandler);
let takeoverTried = false;

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    if (FOLLOW_GAME) {
      void handlePortTaken();
      return;
    }
    log(`Port ${PORT} is already in use. Is the proxy already running? Set PROXY_PORT in .env to use another port.`);
  } else {
    log(`Server error: ${formatError(error)}`);
  }
  setTimeout(() => process.exit(1), 200);
});

statusServer.on('error', (error) => {
  log(`Status port ${STATUS_PORT} unavailable (${error.code || error.message}); the mod will check the main port instead.`);
});

/**
 * Auto-started and the port is taken. If it's an older Open Overlay proxy (e.g. still running
 * from before an update), ask it to stop and take over; otherwise leave it be.
 */
async function handlePortTaken() {
  try {
    if (!takeoverTried) {
      takeoverTried = true;
      const health = await fetch(`http://${HOST}:${PORT}/health`, { signal: AbortSignal.timeout(3000) }).then((r) => r.json()).catch(() => null);
      if (health?.service === 'open-overlay-proxy' && health.version !== VERSION) {
        log(`An older proxy (v${health.version}) is running; asking it to stop so v${VERSION} can take over.`);
        await fetch(`http://${HOST}:${PORT}/shutdown`, { method: 'POST', signal: AbortSignal.timeout(3000) }).catch(() => null);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        server.listen(PORT, HOST);
        return;
      }
    }
  } catch {
    // fall through
  }
  // Another (current) proxy is already serving the game; just make sure the game starts.
  log(`Port ${PORT} is already in use - another proxy is running, so this one is not needed.`);
  if (LAUNCH_GAME) launchGame();
  setTimeout(() => process.exit(0), 500);
}

server.on('listening', () => {
  statusServer.listen(STATUS_PORT, HOST);
  log(`Open Overlay proxy v${VERSION} listening at http://${HOST}:${PORT} (status port ${STATUS_PORT})`);
  log(`Streaming from ${UPSTREAM} (cache ${CACHE_MB} MB, ${MAX_CONCURRENT_UPSTREAM} parallel upstream requests, Referer ${REFERER})`);
  log(`Disk cache in ${DISK_CACHE_DIR}: OpenRailwayMap ${formatBytes(ormDisk.totalBytes)} / ${ORM_DISK_CACHE_GB} GB, Google (keyless) ${formatBytes(googleKeylessDisk.totalBytes)} / ${GOOGLE_KEYLESS_DISK_CACHE_GB} GB`);
  log(`Satellite providers: ${SATELLITE_PROVIDERS.map((p) => `${p.id}${isSatelliteConfigured(p) ? '' : ` (needs ${p.requires})`}`).join(', ')}`);
  if (FOLLOW_GAME) {
    log(GAME_PID !== null
      ? `Running alongside the game (process ${GAME_PID}); this proxy stops by itself when the game closes.`
      : 'Running alongside the game; this proxy stops by itself when Subway Builder closes.');
    if (LAUNCH_GAME) launchGame();
    startGameWatch();
  } else {
    log('Leave this window open while playing. Press Ctrl+C to stop.');
  }
});

server.listen(PORT, HOST);

// --------------------------------------------------------------------------
// Following the game's lifetime
// --------------------------------------------------------------------------

function startGameWatch() {
  const startedWatchAt = Date.now();
  let pid = GAME_PID;
  let processSeen = false;
  let restartGraceUntil = 0;
  let hintLogged = false;

  // The game counts as open while either
  //  - a Subway Builder process is visible, or
  //  - the mod has talked to the proxy recently (it sends a heartbeat every 15 s from the moment
  //    the game starts, including the main menu).
  // Only when both have stopped does the proxy shut down.
  const tick = async () => {
    try {
      const now = Date.now();
      if (pid !== null) {
        if (isPidAlive(pid)) return;
        // The game may be restarting itself (e.g. after enabling mods): wait a little.
        log(`Game process ${pid} exited.`);
        pid = null;
        restartGraceUntil = now + GAME_RESTART_GRACE_MS;
      }

      const running = await isGameRunning();
      if (running) {
        processSeen = true;
        return;
      }

      const heardFromGame = lastRequestAt > 0;
      const recentlyHeard = heardFromGame && now - lastRequestAt < GAME_QUIET_MS;
      if (recentlyHeard) {
        if (!processSeen && !hintLogged) {
          hintLogged = true;
          log(running === null
            ? 'Cannot read the process list here; following the game through the mod\'s heartbeat instead.'
            : `Could not find the game's process${gameExeName ? ` ("${gameExeName}")` : ''}; following the game through the mod's heartbeat instead.`);
        }
        return;
      }
      if (restartGraceUntil && now < restartGraceUntil) return;

      if (processSeen || heardFromGame || restartGraceUntil) {
        shutdown('Subway Builder closed');
      } else if (now - startedWatchAt > GAME_START_TIMEOUT_MS) {
        shutdown('Subway Builder did not start within 10 minutes');
      }
    } catch (error) {
      log(`Game check failed: ${formatError(error)}`);
    }
  };

  const timer = setInterval(() => void tick(), GAME_CHECK_INTERVAL_MS);
  timer.unref?.();
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

let lastDiscoveryAt = 0;
let loggedGameExe = false;

/** true / false, or null if the process list can't be read on this system. */
async function isGameRunning() {
  const names = await listProcessNames();
  if (names === null) return null;
  const lower = names.map((name) => name.toLowerCase());
  if (gameExeName && lower.includes(gameExeName)) {
    if (!loggedGameExe) {
      loggedGameExe = true;
      log(`Watching the game process "${gameExeName}".`);
    }
    return true;
  }
  // Ignore ourselves (node) and the launcher scripts.
  if (names.some((name) => GAME_PROCESS_MATCH.test(name) && !/^(node|wscript|cscript|cmd|sh|bash)(\.exe)?$/i.test(name))) return true;
  // Name unknown: look the game up by its install folder (Windows), at most once a minute.
  if (!gameExeName && process.platform === 'win32' && Date.now() - lastDiscoveryAt > 60000) {
    lastDiscoveryAt = Date.now();
    const discovered = await discoverGameExe();
    if (discovered) {
      gameExeName = discovered;
      log(`Found the game running as "${discovered}"; watching that process from now on.`);
      return true;
    }
  }
  return false;
}

function listProcessNames() {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'tasklist' : 'ps';
    const args = isWindows ? ['/fo', 'csv', '/nh'] : ['-A', '-o', 'comm='];
    execFile(command, args, { windowsHide: true, timeout: 10000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      if (error) return resolve(null);
      resolve(String(stdout).split(/\r?\n/).map((line) => (
        isWindows ? (line.split('","')[0] || '').replace(/^"/, '') : path.basename(line.trim())
      )).filter(Boolean));
    });
  });
}

/** Windows: finds a running program inside a "...\\Subway Builder\\..." folder and returns its file name. */
function discoverGameExe() {
  return new Promise((resolve) => {
    const folder = GAME_FOLDER_MATCH.replace(/'/g, "''");
    const script = `Get-Process | Where-Object { $_.Path -like '*\\${folder}\\*' } | Select-Object -First 1 -ExpandProperty Path`;
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 20000 }, (error, stdout) => {
      if (error) return resolve(null);
      const found = String(stdout).trim().split(/\r?\n/)[0];
      resolve(found ? exeNameOf(found) : null);
    });
  });
}

function exeNameOf(file) {
  const trimmed = String(file || '').trim().replace(/^"|"$/g, '');
  if (!trimmed) return '';
  return trimmed.split(/[\\/]/).pop().toLowerCase();
}

function launchGame() {
  const exe = process.env.SUBWAY_BUILDER_EXE;
  try {
    if (exe) {
      log(`Starting Subway Builder: ${exe}`);
      const child = process.platform === 'darwin' && exe.endsWith('.app')
        ? spawn('open', [exe], { detached: true, stdio: 'ignore' })
        : spawn(exe, [], { detached: true, stdio: 'ignore', cwd: path.dirname(exe) });
      child.unref();
      return;
    }
    const uri = `steam://rungameid/${STEAM_APP_ID}`;
    log(`Starting Subway Builder through Steam (${uri})`);
    const opener = process.platform === 'win32'
      ? spawn('cmd', ['/c', 'start', '""', uri], { detached: true, stdio: 'ignore', windowsHide: true })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [uri], { detached: true, stdio: 'ignore' });
    opener.unref();
  } catch (error) {
    log(`Could not start Subway Builder: ${formatError(error)}`);
  }
}

/** Only the game (file:// pages send Origin "null") or local tools - not websites in a browser. */
function isGameOrigin(request) {
  const origin = String(request.headers.origin || '');
  return !origin || origin === 'null' || origin.startsWith('file://');
}

function openFolder(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const [command, args] = process.platform === 'win32'
      ? ['explorer', [dir]]
      : [process.platform === 'darwin' ? 'open' : 'xdg-open', [dir]];
    spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: false }).unref();
  } catch (error) {
    log(`Could not open ${dir}: ${formatError(error)}`);
  }
}

// Log unexpected errors instead of letting them silently end the proxy.
process.on('uncaughtException', (error) => {
  log(`Unexpected error (proxy keeps running): ${error?.stack || formatError(error)}`);
});
process.on('unhandledRejection', (reason) => {
  log(`Unexpected rejected promise (proxy keeps running): ${reason?.stack || formatError(reason)}`);
});
process.on('exit', (code) => {
  if (code !== 0) log(`Proxy exiting with code ${code}.`);
});

function closeDiskCaches() {
  for (const disk of Object.values(DISK_CACHES)) disk.close();
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    closeDiskCaches();
    process.exit(0);
  });
}

function shutdown(reason) {
  log(`Stopping: ${reason}.`);
  closeDiskCaches();
  server.close();
  statusServer.close();
  setTimeout(() => process.exit(0), 300).unref?.();
}

function envGb(name, fallback) {
  const value = Number.parseFloat(process.env[name] || '');
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function envDays(name, fallback) {
  const value = Number.parseFloat(process.env[name] || '');
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function envMs(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseStringArg(args, name) {
  const index = args.indexOf(name);
  return index >= 0 && typeof args[index + 1] === 'string' ? args[index + 1] : '';
}

function parsePidArg(args) {
  const index = args.indexOf('--game-pid');
  if (index < 0) return null;
  const pid = Number.parseInt(args[index + 1] ?? '', 10);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

async function handleRequest(request, response) {
  lastRequestAt = Date.now();
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === 'POST' && request.url === '/shutdown') {
    // Lets a newer version of the proxy take over (see handlePortTaken).
    if (!isGameOrigin(request)) {
      sendJson(response, 403, { error: 'forbidden_origin' });
      return;
    }
    sendJson(response, 202, { ok: true });
    shutdown('a newer version of the proxy is taking over');
    return;
  }

  if (request.url === '/heartbeat') {
    // Sent by the mod every 15 s while the game is open (see startGameWatch).
    response.writeHead(204, { 'cache-control': 'no-store' });
    response.end();
    return;
  }

  if (request.method === 'POST' && request.url === '/client-log') {
    // The mod's report of what the game's map did with the railway tiles (diagnostics).
    if (!isGameOrigin(request)) {
      sendJson(response, 403, { error: 'forbidden_origin' });
      return;
    }
    const text = await readText(request, 64 * 1024);
    tileStats.clientReports += 1;
    if (text) tileLog(`game ${text.replace(/[\r\n]+/g, ' | ')}`);
    response.writeHead(204, { 'cache-control': 'no-store' });
    response.end();
    return;
  }

  if (request.method === 'POST' && request.url === '/cache/open') {
    if (!isGameOrigin(request)) {
      sendJson(response, 403, { error: 'forbidden_origin' });
      return;
    }
    openFolder(DISK_CACHE_DIR);
    sendJson(response, 202, { ok: true, dir: DISK_CACHE_DIR });
    return;
  }

  const clearMatch = request.method === 'DELETE' && (request.url || '').match(/^\/cache\/(openrailwaymap|google-keyless|all)$/);
  if (clearMatch) {
    if (!isGameOrigin(request)) {
      sendJson(response, 403, { error: 'forbidden_origin' });
      return;
    }
    const targets = clearMatch[1] === 'all' ? Object.values(DISK_CACHES) : [DISK_CACHES[clearMatch[1]]];
    for (const disk of targets) void disk.clear();
    // Drop in-memory copies too so cleared tiles are fetched fresh.
    if (clearMatch[1] !== 'google-keyless') cache.clear();
    if (clearMatch[1] !== 'openrailwaymap') satelliteCache.clear();
    sendJson(response, 202, { ok: true, clearing: clearMatch[1] });
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'method_not_allowed' });
    return;
  }

  const url = new URL(request.url || '/', 'http://localhost');
  const base = resolvePublicBase(request);
  const pathname = url.pathname;

  if (pathname === '/health' || pathname === '/') {
    sendJson(response, 200, buildHealth());
    return;
  }

  if (pathname === '/orm/style.json') {
    const result = await fetchCached(`${UPSTREAM}/style.json`, TTL.style, 'style', { disk: ormDisk, diskFreshMs: TTL.style });
    if (!isOk(result)) return sendUpstreamError(response, result, 'style');
    let style;
    try {
      style = JSON.parse(result.body.toString('utf8'));
    } catch {
      return sendJson(response, 502, { error: 'invalid_style', message: 'Upstream style.json was not valid JSON' });
    }
    sendBody(response, 200, 'application/json; charset=utf-8', Buffer.from(JSON.stringify(rewriteStyle(style, base))), CLIENT_CACHE_CONTROL.style);
    return;
  }

  const tileJsonMatch = pathname.match(TILEJSON_PATH);
  if (tileJsonMatch) {
    const name = tileJsonMatch[1];
    if (!TILE_SOURCE_NAME.test(name)) return sendJson(response, 400, { error: 'invalid_source' });
    const lang = sanitizeLang(url.searchParams.get('lang'));
    const upstreamUrl = `${UPSTREAM}/${name}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`;
    const result = await fetchCached(upstreamUrl, TTL.tilejson, 'tilejson', { disk: ormDisk, diskFreshMs: TTL.tilejson });
    if (!isOk(result)) return sendUpstreamError(response, result, 'tilejson');
    let tileJson;
    try {
      tileJson = JSON.parse(result.body.toString('utf8'));
    } catch {
      return sendJson(response, 502, { error: 'invalid_tilejson' });
    }
    sendBody(response, 200, 'application/json; charset=utf-8', Buffer.from(JSON.stringify(rewriteTileJson(tileJson, name, lang, base))), CLIENT_CACHE_CONTROL.tilejson);
    return;
  }

  const tileMatch = pathname.match(TILE_PATH);
  if (tileMatch) {
    const [, name, z, x, y] = tileMatch;
    if (!TILE_SOURCE_NAME.test(name) || !isValidTile(Number(z), Number(x), Number(y))) {
      return sendJson(response, 400, { error: 'invalid_tile' });
    }
    const lang = sanitizeLang(url.searchParams.get('lang'));
    const upstreamUrl = `${UPSTREAM}/${name}/${z}/${x}/${y}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`;
    // The game reads classic Mapbox Vector Tiles (MVT). Since November 2026 openrailwaymap.app
    // serves the newer MapLibre Tile (MLT) format to its website and caches one copy per tile
    // address - usually MLT. The proxy takes whatever is cached (fast) and converts MLT to MVT
    // itself. Only if a conversion fails does it ask for a freshly made MVT copy ("mvt=1", which
    // the server ignores but caches separately - slow, as the tile is built from scratch).
    const tileOptions = {
      disk: ormDisk,
      diskFreshMs: ORM_DISK_REFRESH_DAYS * 86400000,
      cacheKey: `mvt2:${upstreamUrl}`,
      transform: mltTileToMvt,
      validate: isMvtResponse,
      headers: {
        'user-agent': USER_AGENT,
        'referer': REFERER,
        'accept': 'application/vnd.maplibre-vector-tile, application/x-protobuf;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
      },
    };
    const fetchTile = async () => {
      let tile = await fetchCached(upstreamUrl, TTL.tile, `tiles:${name}`, tileOptions);
      if (tile.invalid) {
        const mvtUrl = `${upstreamUrl}${upstreamUrl.includes('?') ? '&' : '?'}mvt=1`;
        tile = await fetchCached(mvtUrl, TTL.tile, `tiles:${name}`, tileOptions);
        if (tile.invalid) recordFailure(`tiles:${name}`, 'only available as MLT');
      }
      return tile;
    };
    const usable = (tile) => tile && !tile.invalid && (isOk(tile) || tile.status === 204 || tile.status === 404);
    const tileId = { name, z: Number(z), x: Number(x), y: Number(y), lang };
    const startedAt = Date.now();
    const origin = cache.get(`mvt2:${upstreamUrl}`) ? 'memory' : null;
    const pending = fetchTile();
    const logTile = (status, body, how) => {
      tileStats.served[how] = (tileStats.served[how] || 0) + 1;
      if (!TILE_LOG) return;
      const counts = status === 200 ? summarizeMvt(body) : {};
      if (counts === null) tileStats.unreadable += 1;
      tileLog(`tile ${name.split(',')[0]} ${z}/${x}/${y} ${status} ${body ? body.length : 0}B ${how} ${Date.now() - startedAt}ms ${counts === null ? 'UNREADABLE' : Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    };

    let result = await Promise.race([pending, new Promise((resolve) => setTimeout(() => resolve(null), STANDIN_AFTER_MS))]);
    if (!result) {
      // Still downloading: answer now with a stand-in from other zoom levels, if there is one.
      const standIn = await buildStandIn(tileId);
      if (standIn) {
        tileStats.standIns += 1;
        sendBody(response, 200, 'application/x-protobuf', standIn, 'no-store');
        logTile(200, standIn, 'stand-in');
        pending.then(
          (tile) => announceTile(tileId, usable(tile) ? 0 : TTL.error),
          () => announceTile(tileId, TTL.error),
        );
        return;
      }
      result = await pending;
    }

    if (!usable(result)) {
      // Failed: never leave the game with an error (it would not ask again). Show a stand-in or
      // nothing for now, and have the mod ask for the tile again once the failure has expired.
      const standIn = await buildStandIn(tileId);
      announceTile(tileId, TTL.error);
      if (standIn) {
        tileStats.standIns += 1;
        sendBody(response, 200, 'application/x-protobuf', standIn, 'no-store');
        logTile(200, standIn, `failed(${result?.status ?? 'error'})+stand-in`);
      } else {
        response.writeHead(204, { 'cache-control': 'no-store' });
        response.end();
        logTile(204, null, `failed(${result?.status ?? 'error'})`);
      }
      return;
    }
    const how = origin || (result.fromDisk ? 'disk' : result.converted ? 'upstream-mlt' : 'upstream');
    if (result.status === 204 || result.status === 404) {
      // Empty tile: nothing to draw here.
      response.writeHead(204, { 'cache-control': CLIENT_CACHE_CONTROL.tile });
      response.end();
      logTile(result.status, null, how);
      return;
    }
    sendBody(response, 200, 'application/x-protobuf', result.body, CLIENT_CACHE_CONTROL.tile);
    logTile(200, result.body, how);
    return;
  }

  if (pathname === '/tiles/ready') {
    // The mod asks which tiles it should reload (stand-ins whose real tile has arrived, or
    // failed tiles worth another try).
    const since = Number.parseInt(url.searchParams.get('since') || '0', 10) || 0;
    const tiles = readyTiles.filter((entry) => entry.seq > since);
    sendJson(response, 200, { seq: readySeq, tiles: tiles.map(({ name, z, x, y }) => ({ name, z, x, y })) });
    return;
  }

  const spriteMatch = pathname.match(SPRITE_PATH);
  if (spriteMatch) {
    const [, kind, retina = '', ext] = spriteMatch;
    const result = await fetchCached(`${UPSTREAM}/${kind}/symbols${retina}.${ext}`, TTL.sprite, 'sprite', { disk: ormDisk, diskFreshMs: TTL.sprite });
    if (!isOk(result)) return sendUpstreamError(response, result, 'sprite');
    sendBody(response, 200, result.contentType || (ext === 'json' ? 'application/json' : 'image/png'), result.body, CLIENT_CACHE_CONTROL.sprite);
    return;
  }

  if (API_PATHS.some((pattern) => pattern.test(pathname))) {
    const query = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      if (API_QUERY_KEYS.has(key)) query.set(key, value.slice(0, 200));
    }
    const qs = query.toString();
    const upstreamUrl = `${UPSTREAM}${pathname.replace(/^\/orm/, '')}${qs ? `?${qs}` : ''}`;
    const result = await fetchCached(upstreamUrl, TTL.api, 'api');
    if (!isOk(result) && result.status !== 404) return sendUpstreamError(response, result, 'api');
    sendBody(response, result.status, result.contentType || 'application/json', result.body, CLIENT_CACHE_CONTROL.api);
    return;
  }

  if (pathname === '/sat/google/viewport') {
    if (!GOOGLE_MAPS_API_KEY) return sendJson(response, 503, { error: 'provider_not_configured', requires: 'GOOGLE_MAPS_API_KEY' });
    const numbers = ['zoom', 'north', 'south', 'east', 'west'].map((key) => Number(url.searchParams.get(key)));
    if (numbers.some((value) => !Number.isFinite(value))) return sendJson(response, 400, { error: 'invalid_viewport' });
    const [zoom, north, south, east, west] = numbers;
    try {
      const session = await getGoogleSession();
      const upstream = await fetch(`https://tile.googleapis.com/tile/v1/viewport?session=${encodeURIComponent(session)}&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&zoom=${Math.round(zoom)}&north=${north}&south=${south}&east=${east}&west=${west}`, {
        headers: { 'user-agent': USER_AGENT },
      });
      const payload = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return sendJson(response, upstream.status, { error: 'viewport_failed' });
      // Only the attribution text is passed on (it is not cached here).
      return sendJson(response, 200, { copyright: typeof payload.copyright === 'string' ? payload.copyright : '' });
    } catch (error) {
      return sendJson(response, 502, { error: 'viewport_failed', message: formatError(error) });
    }
  }

  const satelliteMatch = pathname.match(SATELLITE_PATH);
  if (satelliteMatch) {
    const [, providerId, z, x, y] = satelliteMatch;
    const provider = SATELLITE_PROVIDERS.find((candidate) => candidate.id === providerId);
    if (!provider) return sendJson(response, 404, { error: 'unknown_provider' });
    if (!isSatelliteConfigured(provider)) return sendJson(response, 503, { error: 'provider_not_configured', requires: provider.requires });
    if (!isValidTile(Number(z), Number(x), Number(y))) return sendJson(response, 400, { error: 'invalid_tile' });
    let upstreamUrl;
    try {
      upstreamUrl = await provider.url(z, x, y);
    } catch (error) {
      recordFailure(`satellite:${providerId}`, error.code || error.name || 'session');
      return sendJson(response, 502, { error: 'provider_session_failed', message: formatError(error) });
    }
    const result = await fetchCached(upstreamUrl, TTL.satellite, `satellite:${providerId}`, {
      cacheStore: satelliteCache,
      cacheKey: `${providerId}/${z}/${x}/${y}`,
      headers: { 'user-agent': USER_AGENT, 'accept': 'image/avif,image/webp,image/png,image/jpeg,*/*' },
      respectUpstreamCache: provider.respectUpstreamCache === true,
      ...(provider.keylessGoogle ? { disk: googleKeylessDisk, diskFreshMs: GOOGLE_KEYLESS_REFRESH_DAYS * 86400000 } : {}),
    });
    if (result.status === 204 || result.status === 404) {
      response.writeHead(204, { 'cache-control': CLIENT_CACHE_CONTROL.tile });
      response.end();
      return;
    }
    if (!isOk(result)) return sendUpstreamError(response, result, `satellite:${providerId}`);
    const cacheControl = provider.respectUpstreamCache
      ? (result.cacheControl || 'no-store')
      : CLIENT_CACHE_CONTROL.satellite;
    sendBody(response, 200, result.contentType || 'image/jpeg', result.body, cacheControl);
    return;
  }

  sendJson(response, 404, { error: 'not_found' });
}

function googleWebTileUrl(layer, z, x, y) {
  const server = (Number(x) + Number(y)) % 4;
  return `https://mt${server}.google.com/vt?lyrs=${layer}&x=${x}&y=${y}&z=${z}`;
}

function isSatelliteConfigured(provider) {
  return provider.configured ? provider.configured() : true;
}

async function getGoogleSession() {
  if (googleSession && googleSession.expiresAt > Date.now() + 60000) return googleSession.session;
  const response = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mapType: 'satellite',
      language: process.env.GOOGLE_MAP_LANGUAGE || 'en-US',
      region: process.env.GOOGLE_MAP_REGION || 'US',
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.session) {
    throw new Error(`Google createSession failed (HTTP ${response.status}${payload?.error?.message ? `: ${payload.error.message}` : ''})`);
  }
  const expiry = Number(payload.expiry) * 1000;
  googleSession = { session: payload.session, expiresAt: Number.isFinite(expiry) && expiry > Date.now() ? expiry : Date.now() + 50 * 60 * 1000 };
  return googleSession.session;
}

// --------------------------------------------------------------------------
// URL rewriting
// --------------------------------------------------------------------------

function rewriteStyle(style, base) {
  const sources = {};
  for (const [id, source] of Object.entries(style.sources || {})) {
    // The proxy serves classic vector tiles only (see the tile route), so drop the MLT encoding.
    const { encoding, ...rest } = source || {};
    void encoding;
    if (source && typeof source.url === 'string' && source.url.startsWith('/')) {
      const name = source.url.slice(1).split('?')[0];
      sources[id] = { ...rest, url: `${base}/orm/tilejson/${name}` };
    } else {
      sources[id] = source && source.type === 'vector' ? rest : source;
    }
  }

  const sprite = Array.isArray(style.sprite)
    ? style.sprite.map((entry) => (
      entry && typeof entry.url === 'string' && entry.url.startsWith('/')
        ? { ...entry, url: `${base}/orm/sprite${entry.url}` }
        : entry
    ))
    : style.sprite;

  return {
    ...style,
    sources,
    sprite,
    metadata: {
      ...(style.metadata || {}),
      'open-overlay:upstream': UPSTREAM,
      'open-overlay:proxyVersion': VERSION,
    },
  };
}

function rewriteTileJson(tileJson, name, lang, base) {
  const query = `?${lang ? `lang=${encodeURIComponent(lang)}&` : ''}v=${TILE_URL_VERSION}`;
  return {
    ...tileJson,
    tiles: [`${base}/orm/tiles/${name}/{z}/{x}/{y}${query}`],
    attribution: tileJson.attribution || '<a href="https://openrailwaymap.app" target="_blank">OpenRailwayMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
  };
}

function resolvePublicBase(request) {
  const host = String(request.headers.host || '');
  if (/^[A-Za-z0-9.\-]+(:\d+)?$/.test(host) || /^\[[0-9a-fA-F:]+\](:\d+)?$/.test(host)) {
    return `http://${host}`;
  }
  return `http://${HOST}:${PORT}`;
}

// --------------------------------------------------------------------------
// Upstream fetching with cache, de-duplication and a concurrency limit
// --------------------------------------------------------------------------

async function fetchCached(url, ttl, category, options = {}) {
  const store = options.cacheStore || cache;
  // Cache key must not contain API keys or session tokens.
  const key = options.cacheKey || url;
  const cached = store.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;
  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    // Only real data may be served stale; remembered failures just expire.
    let stale = cached && !cached.failed ? cached : null;

    // 1. The disk cache (survives restarts).
    if (options.disk) {
      const stored = await options.disk.get(key);
      if (stored) {
        const entry = { status: stored.status, body: stored.body, contentType: stored.contentType, expiresAt: Date.now() + ttl, fromDisk: true };
        const fresh = !options.diskFreshMs || Date.now() - stored.storedAt < options.diskFreshMs;
        if (fresh) {
          store.set(key, entry, entry.body.length + 256);
          return entry;
        }
        stale = entry;
      }
    }

    // 2. Upstream.
    let result;
    try {
      result = await withUpstreamSlot(() => fetchUpstream(url, options.headers));
    } catch (error) {
      recordFailure(category, error.code || error.name || 'error');
      upstreamState.lastFailureAt = new Date().toISOString();
      upstreamState.lastFailure = formatError(error);
      if (stale) return stale;
      return { status: 502, body: Buffer.from(JSON.stringify({ error: 'upstream_unreachable', message: formatError(error) })), contentType: 'application/json', error };
    }

    if (options.transform && result.status >= 200 && result.status < 300) {
      // e.g. convert an MLT tile to MVT before it is cached anywhere.
      try {
        result = options.transform(result);
      } catch (error) {
        recordFailure(category, `conversion failed (${error?.message || error})`);
        return { ...result, invalid: true, expiresAt: Date.now() };
      }
    }
    const success = result.status < 400 || result.status === 404;
    let entryTtl = success ? ttl : TTL.error;
    if (success && options.respectUpstreamCache) entryTtl = upstreamCacheTtl(result.cacheControl);
    const entry = { ...result, expiresAt: Date.now() + entryTtl };
    // A response the caller can't use (e.g. a tile in the wrong format) is never cached.
    if (success && result.status < 300 && options.validate && !options.validate(result)) {
      return { ...entry, invalid: true };
    }
    if (success && entryTtl <= 0) return entry;
    if (success) {
      store.set(key, entry, entry.body.length + 256);
      if (options.disk && (result.status < 300 || result.status === 404)) {
        void options.disk.set(key, { status: result.status, contentType: result.contentType, body: result.body });
      }
      return entry;
    }
    if (stale) {
      // Serve stale data if upstream is having trouble.
      recordFailure(category, `status=${result.status} (served stored copy)`);
      return stale;
    }
    recordFailure(category, `status=${result.status}`);
    // Remember the failure briefly so a refusing server is not hammered by repeat requests.
    store.set(key, { ...entry, failed: true }, entry.body.length + 256);
    return entry;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

async function fetchUpstream(url, headers) {
  upstreamState.requests += 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: headers || {
        'user-agent': USER_AGENT,
        'referer': REFERER,
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    // fetch() transparently decompresses, so we store and serve the plain body.
    const body = Buffer.from(await response.arrayBuffer());
    if (response.status < 400 || response.status === 404) {
      upstreamState.lastSuccessAt = new Date().toISOString();
    } else {
      const host = safeHost(url);
      upstreamState.lastFailureAt = new Date().toISOString();
      upstreamState.lastFailure = `HTTP ${response.status} from ${host}`;
      if (response.status === 403 && host === safeHost(UPSTREAM) && !warnedForbidden) {
        warnedForbidden = true;
        log(`${host} refused a request with HTTP 403. It blocks requests without a Referer; this proxy sends "${REFERER}". If this keeps happening, check ORM_REFERER in .env or the OpenRailwayMap usage policy.`);
      }
    }
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') || '',
      cacheControl: response.headers.get('cache-control') || '',
    };
  } finally {
    clearTimeout(timer);
  }
}

function withUpstreamSlot(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      upstreamActive += 1;
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          upstreamActive -= 1;
          // Newest first: tiles for the view on screen now beat ones for views already left.
          const next = upstreamQueue.pop();
          if (next) next();
        });
    };
    if (upstreamActive < MAX_CONCURRENT_UPSTREAM) run();
    else upstreamQueue.push(run);
  });
}

let warnedForbidden = false;

/** Converts an MLT tile response to MVT; MVT responses pass through unchanged. */
function mltTileToMvt(result) {
  const type = String(result.contentType || '').toLowerCase();
  const isMlt = /maplibre|mlt/.test(type) || (!/protobuf|mapbox-vector-tile/.test(type) && !looksLikeMvt(result.body));
  if (!isMlt || !result.body || result.body.length === 0) return result;
  tileStats.converted += 1;
  return { ...result, body: mltToMvt(result.body), contentType: 'application/x-protobuf', converted: true };
}

const tileStats = { converted: 0, standIns: 0, unreadable: 0, served: {}, clientReports: 0 };

// --------------------------------------------------------------------------
// Stand-in tiles and the "ready" list
// --------------------------------------------------------------------------

const readyTiles = [];
let readySeq = 0;

/** Tells the mod (via /tiles/ready) that a tile should be reloaded, after `delayMs`. */
function announceTile(tile, delayMs) {
  const push = () => {
    readySeq += 1;
    readyTiles.push({ ...tile, seq: readySeq });
    if (readyTiles.length > 5000) readyTiles.splice(0, readyTiles.length - 5000);
  };
  if (delayMs > 0) setTimeout(push, delayMs).unref?.();
  else push();
}

function tileUpstreamUrl(name, z, x, y, lang) {
  return `${UPSTREAM}/${name}/${z}/${x}/${y}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`;
}

/** A tile already saved in memory or on disk (MVT), or null. Empty tiles return an empty buffer. */
async function savedTile(name, z, x, y, lang) {
  if (z < 0 || z > 24) return null;
  const key = `mvt2:${tileUpstreamUrl(name, z, x, y, lang)}`;
  const memory = cache.get(key);
  if (memory && !memory.failed && !memory.invalid) {
    if (memory.status === 204 || memory.status === 404) return Buffer.alloc(0);
    if (memory.status === 200 && memory.body) return memory.body;
  }
  const disk = await ormDisk.get(key);
  if (disk) {
    if (disk.status === 204 || disk.status === 404) return Buffer.alloc(0);
    if (disk.status === 200) return disk.body;
  }
  return null;
}

/**
 * Builds a stand-in for a tile from saved tiles of nearby zoom levels: its children (one or two
 * levels down - common after zooming out) or else its nearest saved ancestor (up to 6 levels up -
 * common after zooming in). Returns null if nothing suitable is saved.
 */
async function buildStandIn({ name, z, x, y, lang }) {
  for (const depth of [1, 2]) {
    const n = 1 << depth;
    const size = 4096 / n;
    const parts = [];
    let known = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const bytes = await savedTile(name, z + depth, x * n + i, y * n + j, lang);
        if (!bytes) continue;
        known += 1;
        if (bytes.length) parts.push({ bytes, scale: 1 / n, dx: i * size, dy: j * size });
      }
    }
    if (known) {
      const composed = parts.length ? composeTile(parts) : null;
      if (composed) return composed;
    }
  }
  for (let depth = 1; depth <= 6 && z - depth >= 0; depth += 1) {
    const bytes = await savedTile(name, z - depth, x >> depth, y >> depth, lang);
    if (!bytes) continue;
    if (!bytes.length) return null; // the ancestor is empty, so this tile is too
    const mask = (1 << depth) - 1;
    const composed = composeTile([{ bytes, scale: 1 << depth, dx: -(x & mask) * 4096, dy: -(y & mask) * 4096 }]);
    if (composed) return composed;
  }
  return null;
}

/** True if a tile response is a classic Mapbox Vector Tile (or empty), not MLT. */
function isMvtResponse(result) {
  if (result.status === 204 || !result.body || result.body.length === 0) return true;
  const type = String(result.contentType || '').toLowerCase();
  if (/maplibre|mlt/.test(type)) return false;
  if (/protobuf|mapbox-vector-tile|mvt/.test(type)) return true;
  // Unknown type: an MVT tile is a list of layers, which always starts with byte 0x1a.
  return result.body[0] === 0x1a;
}

/** How long an upstream response may be kept, per its own Cache-Control header (0 = don't keep). */
function upstreamCacheTtl(cacheControl) {
  const value = String(cacheControl || '').toLowerCase();
  if (!value || /no-store|no-cache/.test(value)) return 0;
  const match = value.match(/(?:^|,)\s*max-age=(\d+)/);
  return match ? Number(match[1]) * 1000 : 0;
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return 'upstream';
  }
}

function isOk(result) {
  return result && result.status >= 200 && result.status < 300;
}

// --------------------------------------------------------------------------
// LRU cache (by bytes)
// --------------------------------------------------------------------------

function LruCache(maxBytes) {
  const map = new Map();
  let bytes = 0;
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return undefined;
      map.delete(key);
      map.set(key, entry);
      return entry.value;
    },
    set(key, value, size) {
      const existing = map.get(key);
      if (existing) {
        bytes -= existing.size;
        map.delete(key);
      }
      if (size > maxBytes) return;
      map.set(key, { value, size });
      bytes += size;
      while (bytes > maxBytes && map.size) {
        const [oldestKey, oldest] = map.entries().next().value;
        map.delete(oldestKey);
        bytes -= oldest.size;
      }
    },
    stats() {
      return { entries: map.size, bytes, maxBytes };
    },
    clear() {
      map.clear();
      bytes = 0;
    },
  };
}

// --------------------------------------------------------------------------
// Responses, health, logging
// --------------------------------------------------------------------------

function buildHealth() {
  return {
    ok: true,
    ready: true,
    status: 'ready',
    service: 'open-overlay-proxy',
    statusPort: STATUS_PORT,
    version: VERSION,
    upstream: UPSTREAM,
    upstreamLastSuccessAt: upstreamState.lastSuccessAt,
    upstreamLastFailureAt: upstreamState.lastFailureAt,
    upstreamLastFailure: upstreamState.lastFailure,
    upstreamRequests: upstreamState.requests,
    upstreamActive,
    upstreamQueued: upstreamQueue.length,
    referer: REFERER,
    tilesConvertedFromMlt: tileStats.converted,
    standInTilesServed: tileStats.standIns,
    tilesServed: tileStats.served,
    unreadableTiles: tileStats.unreadable,
    clientReports: tileStats.clientReports,
    tileLog: TILE_LOG ? TILE_LOG_PATH : null,
    cache: cache.stats(),
    satelliteCache: satelliteCache.stats(),
    diskCacheDir: DISK_CACHE_DIR,
    diskCache: Object.fromEntries(Object.entries(DISK_CACHES).map(([id, disk]) => [id, disk.stats()])),
    satelliteProviders: SATELLITE_PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      attribution: provider.attribution,
      dynamicAttribution: provider.dynamicAttribution === true,
      tileSize: provider.tileSize,
      maxZoom: provider.maxZoom,
      configured: isSatelliteConfigured(provider),
      requires: provider.requires || null,
    })),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  };
}

function sendBody(response, status, contentType, body, cacheControl) {
  response.writeHead(status, {
    'content-type': contentType,
    'content-length': body.length,
    'cache-control': cacheControl,
  });
  response.end(body);
}

function sendJson(response, status, payload) {
  sendBody(response, status, 'application/json; charset=utf-8', Buffer.from(JSON.stringify(payload)), 'no-store');
}

function sendUpstreamError(response, result, category) {
  const status = result?.status && result.status >= 400 ? result.status : 502;
  sendJson(response, status, { error: 'upstream_error', category, status: result?.status ?? null });
}

function recordFailure(category, reason) {
  const key = `${category} ${reason}`;
  failureCounts.set(key, (failureCounts.get(key) || 0) + 1);
  if (failureFlushTimer) return;
  failureFlushTimer = setTimeout(() => {
    failureFlushTimer = null;
    const summary = [...failureCounts.entries()].map(([k, count]) => `${k} x${count}`).join(', ');
    failureCounts.clear();
    if (summary) log(`Upstream problems in the last 15 s: ${summary}`);
  }, 15000);
}

function tileLog(message) {
  try {
    if (fs.existsSync(TILE_LOG_PATH) && fs.statSync(TILE_LOG_PATH).size > TILE_LOG_MAX_BYTES) {
      fs.renameSync(TILE_LOG_PATH, `${TILE_LOG_PATH}.old`);
    }
    fs.appendFileSync(TILE_LOG_PATH, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // diagnostics only
  }
}

function readText(request, limit) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', () => resolve(''));
  });
}

function log(message) {
  const line = `[${new Date().toISOString()}] [orm-proxy] ${message}`;
  console.log(line);
  // Also written to logs/proxy.log, since the proxy may run without a visible window.
  try {
    fs.appendFileSync(LOG_PATH, `${line}\n`);
  } catch {
    // ignore
  }
}

function prepareLogFile() {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > LOG_MAX_BYTES) {
      fs.renameSync(LOG_PATH, `${LOG_PATH}.old`);
    }
  } catch {
    // ignore
  }
}

function formatError(error) {
  if (!error) return 'unknown error';
  if (error.name === 'AbortError') return `timed out after ${UPSTREAM_TIMEOUT_MS} ms`;
  const cause = error.cause ? ` (${error.cause.code || error.cause.message || error.cause})` : '';
  return `${error.message || error}${cause}`;
}

function isValidTile(z, x, y) {
  if (z < 0 || z > 24) return false;
  const max = 2 ** z;
  return x >= 0 && y >= 0 && x < max && y < max;
}

function sanitizeLang(value) {
  if (!value) return '';
  const trimmed = value.trim();
  return /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*(?:,[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*)*$/.test(trimmed) ? trimmed : '';
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readManifestVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
}
