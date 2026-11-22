import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { encodeTile } from '@maplibre/mlt';
import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';

// A real MLT tile, like the ones openrailwaymap.app's cache now mostly holds.
const REAL_MLT = Buffer.from(encodeTile([{ name: 'railway_line_high', extent: 4096, features: [
  { id: 42, geometry: { type: 'LineString', coordinates: [[0, 0], [2048, 2048]] }, properties: { feature: 'rail', usage: 'main' } },
] }]));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPSTREAM_PORT = 18901;
const PROXY_PORT = 18902;
const PROXY = `http://127.0.0.1:${PROXY_PORT}`;

const hits: Record<string, number> = {};
const userAgents = new Set<string>();
const tileAccepts: string[] = [];
let upstream: http.Server;
let proxy: ChildProcess;

before(async () => {
  upstream = http.createServer((req, res) => {
    const url = req.url ?? '/';
    hits[url] = (hits[url] ?? 0) + 1;
    userAgents.add(String(req.headers['user-agent']));
    // Mirrors openrailwaymap.app's nginx: everything except style.json needs a Referer.
    if (url !== '/style.json' && !url.startsWith('/api/') && !req.headers.referer) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (url === '/style.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        version: 8,
        sources: {
          high: { type: 'vector', url: '/railway_line_high,railway_text_km', promoteId: 'id', encoding: 'mlt' },
          ohm: { type: 'vector', tiles: ['https://vtiles.openhistoricalmap.org/{z}/{x}/{y}.pbf'] },
        },
        sprite: [{ id: 'sdf', url: '/sdf_sprite/symbols' }, { id: 'default', url: '/sprite/symbols' }],
        layers: [],
      }));
    } else if (url.startsWith('/railway_line_high,railway_text_km?') || url === '/railway_line_high,railway_text_km') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ tilejson: '3.0.0', tiles: ['https://openrailwaymap.app/railway_line_high,railway_text_km/{z}/{x}/{y}'], minzoom: 7, maxzoom: 30 }));
    } else if (url === '/railway_line_high,railway_text_km/14/100/200') {
      tileAccepts.push(String(req.headers.accept));
      res.writeHead(200, { 'content-type': 'application/x-protobuf' });
      res.end(Buffer.from([1, 2, 3, 4]));
    } else if (url === '/railway_line_high,railway_text_km/14/70/70') {
      res.writeHead(200, { 'content-type': 'application/vnd.maplibre-vector-tile' });
      res.end(REAL_MLT);
    } else if (url === '/railway_line_high,railway_text_km/13/35/35') {
      res.writeHead(200, { 'content-type': 'application/vnd.maplibre-vector-tile' });
      res.end(REAL_MLT);
    } else if (url === '/railway_line_high,railway_text_km/14/71/70') {
      // Slow, like a fresh tile openrailwaymap.app has to build first.
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'application/vnd.maplibre-vector-tile' });
        res.end(REAL_MLT);
      }, 2500);
      return;
    } else if (url === '/railway_line_high,railway_text_km/14/50/50') {
      // Like openrailwaymap.app's cache: this address holds the MLT copy the website asked for.
      res.writeHead(200, { 'content-type': 'application/vnd.maplibre-vector-tile' });
      res.end(Buffer.from([9, 9, 9]));
    } else if (url === '/railway_line_high,railway_text_km/14/50/50?mvt=1') {
      res.writeHead(200, { 'content-type': 'application/x-protobuf' });
      res.end(Buffer.from([0x1a, 1, 2]));
    } else if (url === '/railway_line_high,railway_text_km/14/60/60' || url === '/railway_line_high,railway_text_km/14/60/60?mvt=1') {
      res.writeHead(200, { 'content-type': 'application/vnd.maplibre-vector-tile' });
      res.end(Buffer.from([9, 9, 9]));
    } else if (url === '/railway_line_high,railway_text_km/14/0/0') {
      res.writeHead(204);
      res.end();
    } else if (url === '/sdf_sprite/symbols@2x.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"general/station":{"x":0,"y":0,"width":2,"height":2,"pixelRatio":2,"sdf":true}}');
    } else if (url.startsWith('/api/facility?')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify([{ name: 'Test', latitude: 103.7, longitude: 1.33, query: url }]));
    } else {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":"nope"}');
    }
  });
  await new Promise<void>((resolve) => upstream.listen(UPSTREAM_PORT, '127.0.0.1', resolve));

  proxy = spawn(process.execPath, [path.join(root, 'proxy.js')], {
    cwd: root,
    env: { ...process.env, PROXY_PORT: String(PROXY_PORT), ORM_UPSTREAM: `http://127.0.0.1:${UPSTREAM_PORT}`, OPEN_OVERLAY_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'open-overlay-test-')) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('proxy did not start')), 5000);
    proxy.stdout!.on('data', (chunk) => {
      if (String(chunk).includes('listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proxy.on('exit', (code) => reject(new Error(`proxy exited ${code}`)));
  });
});

after(() => {
  proxy?.kill();
  upstream?.close();
});

test('health identifies the proxy', async () => {
  const health = await (await fetch(`${PROXY}/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'open-overlay-proxy');
});

test('style URLs are rewritten to stream through the proxy', async () => {
  const response = await fetch(`${PROXY}/orm/style.json`);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  const style = await response.json();
  assert.equal(style.sources.high.url, `${PROXY}/orm/tilejson/railway_line_high,railway_text_km`);
  // openrailwaymap.app marks its sources as MLT; the proxy serves classic vector tiles instead.
  assert.equal(style.sources.high.encoding, undefined);
  assert.equal(style.sources.ohm.tiles[0], 'https://vtiles.openhistoricalmap.org/{z}/{x}/{y}.pbf');
  assert.deepEqual(style.sprite.map((s: { url: string }) => s.url), [
    `${PROXY}/orm/sprite/sdf_sprite/symbols`,
    `${PROXY}/orm/sprite/sprite/symbols`,
  ]);
});

test('TileJSON tile templates point at the proxy and keep the language', async () => {
  const tj = await (await fetch(`${PROXY}/orm/tilejson/railway_line_high,railway_text_km?lang=en`)).json();
  assert.deepEqual(tj.tiles, [`${PROXY}/orm/tiles/railway_line_high,railway_text_km/{z}/{x}/{y}?lang=en&v=3`]);
  assert.equal(tj.minzoom, 7);
  assert.ok(tj.attribution.includes('OpenRailwayMap'));
});

test('vector tiles stream, cache and send an honest User-Agent', async () => {
  const first = await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/100/200`);
  assert.equal(first.status, 200);
  assert.deepEqual([...new Uint8Array(await first.arrayBuffer())], [1, 2, 3, 4]);
  await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/100/200`);
  assert.equal(hits['/railway_line_high,railway_text_km/14/100/200'], 1, 'second request served from cache');
  // Takes whatever the server has cached (MLT preferred), converting MLT itself.
  assert.deepEqual(tileAccepts, ['application/vnd.maplibre-vector-tile, application/x-protobuf;q=0.9']);
  for (const ua of userAgents) assert.match(ua, /^SubwayBuilder-OpenOverlay\/[\d.]+ \(Subway Builder game mod; local tile proxy[^)]*\)$/);
});

test('empty and missing tiles become 204', async () => {
  assert.equal((await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/0/0`)).status, 204);
  assert.equal((await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/1/1`)).status, 204);
});

test('rejects invalid paths and tile coordinates', async () => {
  assert.equal((await fetch(`${PROXY}/orm/tiles/railway_line_high/3/9/9`)).status, 400);
  assert.equal((await fetch(`${PROXY}/orm/tiles/..%2Fetc/1/0/0`)).status, 404);
  assert.equal((await fetch(`${PROXY}/orm/api/admin`)).status, 404);
});

test('sprites and API pass through with filtered query parameters', async () => {
  const sprite = await (await fetch(`${PROXY}/orm/sprite/sdf_sprite/symbols@2x.json`)).json();
  assert.equal(sprite['general/station'].sdf, true);
  const rows = await (await fetch(`${PROXY}/orm/api/facility?q=Jurong&limit=5&evil=1`)).json();
  assert.equal(rows[0].name, 'Test');
  assert.match(rows[0].query, /q=Jurong/);
  assert.doesNotMatch(rows[0].query, /evil/);
});

test('health lists satellite providers and keyed ones stay unavailable without a key', async () => {
  const health = await (await fetch(`${PROXY}/health`)).json();
  const ids = health.satelliteProviders.map((p: { id: string }) => p.id);
  assert.deepEqual(ids, ['google-sat', 'google-hybrid', 'osm', 'google']);
  const google = health.satelliteProviders.find((p: { id: string }) => p.id === 'google');
  assert.equal(google.dynamicAttribution, true);
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    assert.equal((await fetch(`${PROXY}/sat/google/1/0/0`)).status, 503);
    assert.equal((await fetch(`${PROXY}/sat/google/viewport?zoom=1&north=1&south=0&east=1&west=0`)).status, 503);
  }
  // Removed providers are gone.
  assert.equal((await fetch(`${PROXY}/sat/esri/1/0/0`)).status, 404);
  assert.equal((await fetch(`${PROXY}/sat/maptiler/1/0/0`)).status, 404);
  assert.equal((await fetch(`${PROXY}/sat/nope/1/0/0`)).status, 404);
  assert.equal((await fetch(`${PROXY}/sat/osm/2/9/9`)).status, 400);
});

test('tiles cached upstream in the MLT format are fetched again as classic vector tiles', async () => {
  const first = await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/50/50`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('content-type'), 'application/x-protobuf');
  assert.deepEqual([...new Uint8Array(await first.arrayBuffer())], [0x1a, 1, 2]);
  // Cached as MVT: no further upstream requests.
  await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/50/50`);
  assert.equal(hits['/railway_line_high,railway_text_km/14/50/50?mvt=1'], 1);
  // A tile that fails to convert falls back to a fresh MVT copy; one that is only ever
  // unreadable reaches the game as an empty tile rather than one it can't read.
  const mltOnly = await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/60/60`);
  assert.equal(mltOnly.status, 204);
});

test('cached MLT tiles are converted to MVT in the proxy, without the slow fresh-tile route', async () => {
  const response = await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/70/70`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/x-protobuf');
  const tile = new VectorTile(new Protobuf(new Uint8Array(await response.arrayBuffer())));
  const feature = tile.layers.railway_line_high.feature(0);
  assert.equal(feature.id, 42);
  assert.equal(feature.properties.usage, 'main');
  assert.deepEqual(feature.loadGeometry()[0].map((p) => [p.x, p.y]), [[0, 0], [2048, 2048]]);
  assert.equal(hits['/railway_line_high,railway_text_km/14/70/70?mvt=1'], undefined);
  const health = await (await fetch(`${PROXY}/health`)).json();
  assert.ok(health.tilesConvertedFromMlt >= 1);
});

test('slow tiles get a stand-in from a saved tile of another zoom level, then are listed as ready', async () => {
  const before = await (await fetch(`${PROXY}/tiles/ready?since=0`)).json();
  // The parent (zoom 13) is saved first, e.g. from before zooming in.
  assert.equal((await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/13/35/35`)).status, 200);

  const started = Date.now();
  const standIn = await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/71/70`);
  assert.equal(standIn.status, 200);
  assert.ok(Date.now() - started < 2000, 'stand-in should not wait for the slow tile');
  assert.equal(standIn.headers.get('cache-control'), 'no-store');
  const tile = new VectorTile(new Protobuf(new Uint8Array(await standIn.arrayBuffer())));
  assert.equal(tile.layers.railway_line_high.length, 1);

  await new Promise((resolve) => setTimeout(resolve, 2500));
  const ready = await (await fetch(`${PROXY}/tiles/ready?since=${before.seq}`)).json();
  assert.deepEqual(ready.tiles, [{ name: 'railway_line_high,railway_text_km', z: 14, x: 71, y: 70 }]);

  const real = await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/71/70`);
  assert.equal(real.status, 200);
  assert.notEqual(real.headers.get('cache-control'), 'no-store');
  const health = await (await fetch(`${PROXY}/health`)).json();
  assert.ok(health.standInTilesServed >= 1);
});

test('tiles are logged with their feature counts, and the mod can add its reports', async () => {
  await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/70/70`);
  const post = await fetch(`${PROXY}/client-log`, { method: 'POST', body: 'zoom 9.0 | railway_line_high: loaded=12' });
  assert.equal(post.status, 204);
  const health = await (await fetch(`${PROXY}/health`)).json();
  const text = fs.readFileSync(health.tileLog, 'utf8');
  assert.match(text, /tile railway_line_high 14\/70\/70 200 \d+B \w[\w-]* \d+ms railway_line_high=1/);
  assert.match(text, /game zoom 9\.0 \| railway_line_high: loaded=12/);
});
