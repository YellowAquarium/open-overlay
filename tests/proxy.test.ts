import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPSTREAM_PORT = 18901;
const PROXY_PORT = 18902;
const PROXY = `http://127.0.0.1:${PROXY_PORT}`;

const hits: Record<string, number> = {};
const userAgents = new Set<string>();
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
          high: { type: 'vector', url: '/railway_line_high,railway_text_km', promoteId: 'id' },
          ohm: { type: 'vector', tiles: ['https://vtiles.openhistoricalmap.org/{z}/{x}/{y}.pbf'] },
        },
        sprite: [{ id: 'sdf', url: '/sdf_sprite/symbols' }, { id: 'default', url: '/sprite/symbols' }],
        layers: [],
      }));
    } else if (url.startsWith('/railway_line_high,railway_text_km?') || url === '/railway_line_high,railway_text_km') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ tilejson: '3.0.0', tiles: ['https://openrailwaymap.app/railway_line_high,railway_text_km/{z}/{x}/{y}'], minzoom: 7, maxzoom: 30 }));
    } else if (url === '/railway_line_high,railway_text_km/14/100/200') {
      res.writeHead(200, { 'content-type': 'application/x-protobuf' });
      res.end(Buffer.from([1, 2, 3, 4]));
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
    env: { ...process.env, PROXY_PORT: String(PROXY_PORT), ORM_UPSTREAM: `http://127.0.0.1:${UPSTREAM_PORT}` },
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
  assert.equal(style.sources.ohm.tiles[0], 'https://vtiles.openhistoricalmap.org/{z}/{x}/{y}.pbf');
  assert.deepEqual(style.sprite.map((s: { url: string }) => s.url), [
    `${PROXY}/orm/sprite/sdf_sprite/symbols`,
    `${PROXY}/orm/sprite/sprite/symbols`,
  ]);
});

test('TileJSON tile templates point at the proxy and keep the language', async () => {
  const tj = await (await fetch(`${PROXY}/orm/tilejson/railway_line_high,railway_text_km?lang=en`)).json();
  assert.deepEqual(tj.tiles, [`${PROXY}/orm/tiles/railway_line_high,railway_text_km/{z}/{x}/{y}?lang=en`]);
  assert.equal(tj.minzoom, 7);
  assert.ok(tj.attribution.includes('OpenRailwayMap'));
});

test('vector tiles stream, cache and send an honest User-Agent', async () => {
  const first = await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/100/200`);
  assert.equal(first.status, 200);
  assert.deepEqual([...new Uint8Array(await first.arrayBuffer())], [1, 2, 3, 4]);
  await fetch(`${PROXY}/orm/tiles/railway_line_high,railway_text_km/14/100/200`);
  assert.equal(hits['/railway_line_high,railway_text_km/14/100/200'], 1, 'second request served from cache');
  for (const ua of userAgents) assert.match(ua, /^SubwayBuilder-OpenOverlay\/[\d.]+ \(.*contact: mahyeung84@gmail\.com\)$/);
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
