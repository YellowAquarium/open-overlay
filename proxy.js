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
const GAME_CHECK_INTERVAL_MS = envMs('GAME_CHECK_INTERVAL_MS', 5000);
const GAME_START_TIMEOUT_MS = envMs('GAME_START_TIMEOUT_MS', 10 * 60 * 1000); // time for Steam / updates to start the game
const GAME_RESTART_GRACE_MS = envMs('GAME_RESTART_GRACE_MS', 30000);          // the game may relaunch itself (mod changes)
const GAME_QUIET_MS = envMs('GAME_QUIET_MS', 60000);                          // never stop while the game is still talking to us
const IDLE_FALLBACK_MS = envMs('IDLE_FALLBACK_MS', 30 * 60 * 1000);           // if process detection is unavailable
const LOG_PATH = path.join(__dirname, 'logs', 'proxy.log');
const LOG_MAX_BYTES = 1024 * 1024;
prepareLogFile();
let lastRequestAt = 0;
const PORT = Number.parseInt(process.env.PROXY_PORT || '8788', 10);
const HOST = process.env.PROXY_HOST || '127.0.0.1';
const UPSTREAM = (process.env.ORM_UPSTREAM || 'https://openrailwaymap.app').replace(/\/+$/, '');
// OpenRailwayMap's usage policy requires an honest User-Agent for non-browser clients.
// OpenStreetMap's tile policy also asks for a way to contact the app's maintainer.
const CONTACT = process.env.ORM_CONTACT || 'mahyeung84@gmail.com';
const USER_AGENT = process.env.ORM_USER_AGENT ||
  `SubwayBuilder-OpenOverlay/${VERSION} (Subway Builder game mod; local tile proxy; contact: ${CONTACT})`;
// openrailwaymap.app rejects tile, TileJSON and sprite requests that carry no Referer (HTTP 403).
// Its usage policy asks browser-style applications to send a real, non-faked Referer, so this
// identifies the page where the overlay is published. Change it in .env if you host the mod elsewhere.
const REFERER = process.env.ORM_REFERER || 'https://github.com/YellowAquarium/open-overlay';
const CACHE_MB = clampNumber(Number.parseInt(process.env.ORM_CACHE_MB || '256', 10), 16, 4096, 256);
const MAX_CONCURRENT_UPSTREAM = clampNumber(Number.parseInt(process.env.ORM_MAX_CONCURRENT || '8', 10), 1, 32, 8);
const SATELLITE_CACHE_MB = clampNumber(Number.parseInt(process.env.SATELLITE_CACHE_MB || '256', 10), 16, 4096, 256);
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const UPSTREAM_TIMEOUT_MS = 30000;

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
    url: (z, x, y) => googleWebTileUrl('s', z, x, y),
  },
  {
    id: 'google-hybrid',
    label: 'Google Hybrid (no key, unofficial)',
    attribution: 'Imagery © Google, map data © Google',
    tileSize: 256,
    maxZoom: 20,
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
const inflight = new Map();
const upstreamQueue = [];
let upstreamActive = 0;
const failureCounts = new Map();
let failureFlushTimer = null;
const upstreamState = { lastSuccessAt: null, lastFailureAt: null, lastFailure: null, requests: 0 };

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    log(`Unhandled error for ${request.url}: ${formatError(error)}`);
    if (!response.headersSent) sendJson(response, 500, { error: 'proxy_error', message: String(error?.message || error) });
    else response.destroy(error);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    if (FOLLOW_GAME) {
      // Another proxy is already serving the game; just make sure the game starts.
      log(`Port ${PORT} is already in use - another proxy is running, so this one is not needed.`);
      if (LAUNCH_GAME) launchGame();
      setTimeout(() => process.exit(0), 500);
      return;
    }
    log(`Port ${PORT} is already in use. Is the proxy already running? Set PROXY_PORT in .env to use another port.`);
  } else {
    log(`Server error: ${formatError(error)}`);
  }
  setTimeout(() => process.exit(1), 200);
});

server.listen(PORT, HOST, () => {
  log(`Open Overlay proxy v${VERSION} listening at http://${HOST}:${PORT}`);
  log(`Streaming from ${UPSTREAM} (cache ${CACHE_MB} MB, ${MAX_CONCURRENT_UPSTREAM} parallel upstream requests, Referer ${REFERER})`);
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

// --------------------------------------------------------------------------
// Following the game's lifetime
// --------------------------------------------------------------------------

function startGameWatch() {
  const startedWatchAt = Date.now();
  let pid = GAME_PID;
  let seenGame = pid !== null;
  let misses = 0;
  let graceUntil = 0;
  let detectionWorks = true;

  const tick = async () => {
    try {
      if (pid !== null) {
        if (isPidAlive(pid)) return;
        // The game process ended. It may be restarting itself (e.g. after enabling mods),
        // so look for a new Subway Builder process for a short while before stopping.
        log(`Game process ${pid} exited.`);
        pid = null;
        seenGame = false;
        graceUntil = Date.now() + GAME_RESTART_GRACE_MS;
        return;
      }

      const running = await isGameRunning();
      if (running === null) {
        detectionWorks = false;
      } else if (running) {
        detectionWorks = true;
        seenGame = true;
        misses = 0;
        return;
      }

      const now = Date.now();
      if (!detectionWorks) {
        // Can't see processes on this system: stop after a long time without game traffic.
        const lastActivity = Math.max(lastRequestAt, startedWatchAt);
        if (now - lastActivity > IDLE_FALLBACK_MS) shutdown('no requests from the game for 30 minutes');
        return;
      }
      if (seenGame) {
        misses += 1;
        if (misses >= 2) shutdown('Subway Builder closed');
        return;
      }
      if (graceUntil && now > graceUntil && now - lastRequestAt > GAME_QUIET_MS) {
        shutdown('Subway Builder closed');
      } else if (!graceUntil && now - startedWatchAt > GAME_START_TIMEOUT_MS && now - lastRequestAt > GAME_QUIET_MS) {
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

/** true / false, or null if the process list can't be read on this system. */
function isGameRunning() {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'tasklist' : 'ps';
    const args = isWindows ? ['/fo', 'csv', '/nh'] : ['-A', '-o', 'comm='];
    execFile(command, args, { windowsHide: true, timeout: 10000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      if (error) return resolve(null);
      const names = String(stdout).split(/\r?\n/).map((line) => (
        isWindows ? (line.split('","')[0] || '').replace(/^"/, '') : path.basename(line.trim())
      ));
      // Ignore ourselves (node) and the launcher scripts.
      resolve(names.some((name) => GAME_PROCESS_MATCH.test(name) && !/^(node|wscript|cscript|cmd|sh|bash)(\.exe)?$/i.test(name)));
    });
  });
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

function shutdown(reason) {
  log(`Stopping: ${reason}.`);
  server.close();
  setTimeout(() => process.exit(0), 300).unref?.();
}

function envMs(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
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
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
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
    const result = await fetchCached(`${UPSTREAM}/style.json`, TTL.style, 'style');
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
    const result = await fetchCached(upstreamUrl, TTL.tilejson, 'tilejson');
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
    const result = await fetchCached(upstreamUrl, TTL.tile, `tiles:${name}`);
    if (result.status === 204 || result.status === 404) {
      // Empty tile: nothing to draw here.
      response.writeHead(204, { 'cache-control': CLIENT_CACHE_CONTROL.tile });
      response.end();
      return;
    }
    if (!isOk(result)) return sendUpstreamError(response, result, `tiles:${name}`);
    sendBody(response, 200, result.contentType || 'application/x-protobuf', result.body, CLIENT_CACHE_CONTROL.tile);
    return;
  }

  const spriteMatch = pathname.match(SPRITE_PATH);
  if (spriteMatch) {
    const [, kind, retina = '', ext] = spriteMatch;
    const result = await fetchCached(`${UPSTREAM}/${kind}/symbols${retina}.${ext}`, TTL.sprite, 'sprite');
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
    if (source && typeof source.url === 'string' && source.url.startsWith('/')) {
      const name = source.url.slice(1).split('?')[0];
      sources[id] = { ...source, url: `${base}/orm/tilejson/${name}` };
    } else {
      sources[id] = source;
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
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';
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
  // Only real data may be served stale; remembered failures just expire.
  const stale = cached && !cached.failed ? cached : null;

  if (inflight.has(key)) return inflight.get(key);

  const promise = withUpstreamSlot(() => fetchUpstream(url, options.headers))
    .then((result) => {
      const success = result.status < 400 || result.status === 404;
      let entryTtl = success ? ttl : TTL.error;
      if (success && options.respectUpstreamCache) entryTtl = upstreamCacheTtl(result.cacheControl);
      const entry = { ...result, expiresAt: Date.now() + entryTtl };
      if (success && entryTtl <= 0) return entry;
      if (success) {
        store.set(key, entry, entry.body.length + 256);
      } else if (stale) {
        // Serve stale data if upstream is having trouble.
        recordFailure(category, `status=${result.status} (served stale)`);
        return stale;
      } else {
        recordFailure(category, `status=${result.status}`);
        // Remember the failure briefly so a refusing server is not hammered by repeat requests.
        store.set(key, { ...entry, failed: true }, entry.body.length + 256);
      }
      return entry;
    })
    .catch((error) => {
      recordFailure(category, error.code || error.name || 'error');
      upstreamState.lastFailureAt = new Date().toISOString();
      upstreamState.lastFailure = formatError(error);
      if (stale) return stale;
      return { status: 502, body: Buffer.from(JSON.stringify({ error: 'upstream_unreachable', message: formatError(error) })), contentType: 'application/json', error };
    })
    .finally(() => inflight.delete(key));

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
          const next = upstreamQueue.shift();
          if (next) next();
        });
    };
    if (upstreamActive < MAX_CONCURRENT_UPSTREAM) run();
    else upstreamQueue.push(run);
  });
}

let warnedForbidden = false;

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
    version: VERSION,
    upstream: UPSTREAM,
    upstreamLastSuccessAt: upstreamState.lastSuccessAt,
    upstreamLastFailureAt: upstreamState.lastFailureAt,
    upstreamLastFailure: upstreamState.lastFailure,
    upstreamRequests: upstreamState.requests,
    upstreamActive,
    upstreamQueued: upstreamQueue.length,
    referer: REFERER,
    cache: cache.stats(),
    satelliteCache: satelliteCache.stats(),
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
