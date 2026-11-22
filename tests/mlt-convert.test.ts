import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTile } from '@maplibre/mlt';
import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
// @ts-ignore - bundled plain JS shipped next to proxy.js
import { mltToMvt, looksLikeMvt, composeTile } from '../mlt-convert.js';

test('MLT tiles convert to MVT tiles with the same layers, geometry and properties', () => {
  const mlt = encodeTile([
    { name: 'railway_line_high', extent: 4096, features: [
      { id: 7, geometry: { type: 'LineString', coordinates: [[0, 0], [100, 50], [4000, 4000]] }, properties: { feature: 'rail', usage: 'main', maxspeed: 120, electrified: true, ref: null } },
      { id: 8, geometry: { type: 'MultiLineString', coordinates: [[[1, 1], [2, 2]], [[5, 5], [9, 9]]] }, properties: { feature: 'rail' } },
    ] },
    { name: 'standard_railway_platforms', extent: 4096, features: [
      { id: 1, geometry: { type: 'Polygon', coordinates: [[[10, 10], [20, 10], [20, 20], [10, 20]]] }, properties: { ref: '1' } },
    ] },
    { name: 'standard_railway_text_stations', extent: 4096, features: [
      { id: 3, geometry: { type: 'Point', coordinates: [5, 6] }, properties: { name: 'Shinjuku', rank: 9 } },
    ] },
  ]);
  assert.equal(looksLikeMvt(mlt), false);

  const mvt = mltToMvt(mlt);
  assert.equal(looksLikeMvt(mvt), true);
  const tile = new VectorTile(new Protobuf(mvt));
  assert.deepEqual(Object.keys(tile.layers).sort(), ['railway_line_high', 'standard_railway_platforms', 'standard_railway_text_stations']);

  const lines = tile.layers.railway_line_high;
  assert.equal(lines.extent, 4096);
  assert.equal(lines.length, 2);
  const main = lines.feature(0);
  assert.equal(main.id, 7);
  assert.equal(main.type, 2);
  assert.deepEqual({ ...main.properties }, { feature: 'rail', usage: 'main', maxspeed: 120, electrified: true });
  assert.deepEqual(main.loadGeometry().map((ring) => ring.map((p) => [p.x, p.y])), [[[0, 0], [100, 50], [4000, 4000]]]);
  assert.deepEqual(lines.feature(1).loadGeometry().map((ring) => ring.map((p) => [p.x, p.y])), [[[1, 1], [2, 2]], [[5, 5], [9, 9]]]);

  const platform = tile.layers.standard_railway_platforms.feature(0);
  assert.equal(platform.type, 3);
  assert.deepEqual(platform.loadGeometry()[0].map((p) => [p.x, p.y]), [[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]);

  const station = tile.layers.standard_railway_text_stations.feature(0);
  assert.equal(station.type, 1);
  assert.deepEqual({ ...station.properties }, { name: 'Shinjuku', rank: 9 });
  assert.deepEqual(station.loadGeometry()[0].map((p) => [p.x, p.y]), [[5, 6]]);
});

test('MVT tiles are recognised and bad data throws', () => {
  assert.equal(looksLikeMvt(Buffer.from([0x1a, 0x02])), true);
  assert.equal(looksLikeMvt(Buffer.alloc(0)), true);
  assert.throws(() => mltToMvt(Buffer.from([1, 2, 3, 4, 5, 6, 7])));
});

test('composeTile builds a stand-in from child tiles and from an ancestor tile', () => {
  const child = mltToMvt(encodeTile([{ name: 'railway_line_high', extent: 4096, features: [
    { id: 1, geometry: { type: 'LineString', coordinates: [[0, 0], [4096, 4096]] }, properties: { feature: 'rail' } },
  ] }]));
  // Four children, each scaled to a quarter of the parent tile.
  const parts = [0, 1].flatMap((i) => [0, 1].map((j) => ({ bytes: child, scale: 0.5, dx: i * 2048, dy: j * 2048 })));
  const fromChildren = new VectorTile(new Protobuf(composeTile(parts)));
  const layer = fromChildren.layers.railway_line_high;
  assert.equal(layer.length, 4);
  assert.equal(layer.feature(0).properties.feature, 'rail');
  const extent = layer.extent;
  const lastLine = layer.feature(3).loadGeometry()[0];
  assert.deepEqual([lastLine[1].x / extent, lastLine[1].y / extent], [1, 1]);

  // The bottom-right quarter of an ancestor, blown up to a full tile.
  const fromParent = new VectorTile(new Protobuf(composeTile([{ bytes: child, scale: 2, dx: -4096, dy: -4096 }])));
  const line = fromParent.layers.railway_line_high.feature(0).loadGeometry()[0];
  assert.deepEqual([line[0].x, line[0].y, line[1].x, line[1].y].map((v) => v / fromParent.layers.railway_line_high.extent), [-1, -1, 1, 1]);

  // Nothing near the target tile: no stand-in.
  assert.equal(composeTile([{ bytes: child, scale: 1, dx: 9000, dy: 9000 }]), null);
});
