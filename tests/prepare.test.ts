import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bakeGlobalState,
  collectGlobalStateKeys,
  detectGameFonts,
  isDarkColor,
  prepareStyle,
  scaleOpacity,
  applyOpacity,
  type OrmStyle,
} from '../src/style/prepare';
import { matchPreset, normalizeSettings, DEFAULT_MAP_STATE, PRESETS } from '../src/config';

// Shapes copied from OpenRailwayMap-vector's proxy/js/styles.mjs (trimmed).
const fixture: OrmStyle = {
  version: 8,
  sprite: [
    { id: 'sdf', url: 'http://127.0.0.1:8788/orm/sprite/sdf_sprite/symbols' },
    { id: 'default', url: 'http://127.0.0.1:8788/orm/sprite/sprite/symbols' },
  ],
  sources: {
    search: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    route: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    openrailwaymap_stations: {
      type: 'vector',
      url: 'http://127.0.0.1:8788/orm/tilejson/standard_railway_text_stations,standard_railway_grouped_stations',
      promoteId: 'id',
      metadata: { supports: ['language'] },
    },
    openrailwaymap_platforms: { type: 'vector', url: 'http://127.0.0.1:8788/orm/tilejson/standard_railway_platforms,standard_railway_platform_edges', promoteId: 'id' },
    openhistoricalmap: { type: 'vector', tiles: ['https://vtiles.openhistoricalmap.org/maps/osm/{z}/{x}/{y}.pbf'] },
    dem: { type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'] },
  },
  layers: [
    { id: 'hillshade', type: 'hillshade', source: 'dem' },
    {
      id: 'platforms_fill',
      type: 'fill',
      source: 'openrailwaymap_platforms',
      'source-layer': 'standard_railway_platforms',
      layout: { visibility: ['case', ['==', ['global-state', 'platforms'], 'plain'], 'visible', 'none'] },
      paint: {
        'fill-color': ['case', ['==', ['global-state', 'theme'], 'light'], '#aaa', '#444'],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.2, 17, 0.6],
      },
    },
    {
      id: 'stations_text',
      type: 'symbol',
      source: 'openrailwaymap_stations',
      'source-layer': 'standard_railway_text_stations',
      filter: ['in', ['get', 'feature'], ['literal', ['global-state', 'not-a-real-expression']]],
      layout: {
        visibility: ['case', ['in', ['global-state', 'stations'], ['literal', ['station', 'operator']]], 'visible', 'none'],
        'text-font': ['Helvetica-Neue-Bold', 'Arial-Bold'],
        'icon-image': ['image', ['concat', 'sdf:', 'general/station']],
      },
      paint: { 'text-color': 'black' },
    },
    { id: 'ohm_stations', type: 'circle', source: 'openhistoricalmap', 'source-layer': 'transport_points' },
    { id: 'route', type: 'line', source: 'route', paint: { 'line-width': 5 } },
  ],
  state: {
    theme: { default: 'light' },
    platforms: { default: 'plain' },
    stations: { default: 'station' },
    pois: { default: ['radio', 'facility'] },
  },
};

const prepare = (extra: Partial<Parameters<typeof prepareStyle>[1]> = {}) => prepareStyle(fixture, {
  namespace: 'orm',
  globalStateKey: (key) => `orm_${key}`,
  ...extra,
});

test('drops background, terrain and historical sources and their layers', () => {
  const prepared = prepare();
  assert.deepEqual(Object.keys(prepared.sources).sort(), [
    'orm:src:openrailwaymap_platforms',
    'orm:src:openrailwaymap_stations',
    'orm:src:route',
  ]);
  assert.deepEqual(prepared.layers.map((l) => l.originalId), ['platforms_fill', 'stations_text', 'route']);
  assert.deepEqual(prepared.droppedLayers.sort(), ['hillshade', 'ohm_stations']);
});

test('namespaces layer ids, source ids and global-state keys but not literals', () => {
  const prepared = prepare();
  const stations = prepared.layers.find((l) => l.originalId === 'stations_text')!;
  assert.equal(stations.id, 'orm:stations_text');
  assert.equal(stations.layer.source, 'orm:src:openrailwaymap_stations');
  assert.equal(stations.originalSource, 'openrailwaymap_stations');
  assert.deepEqual([...collectGlobalStateKeys(stations.layer.layout)], ['orm_stations']);
  // literal contents must never be rewritten
  assert.deepEqual(stations.layer.filter, fixture.layers[2].filter);
  // icon expressions untouched
  assert.deepEqual(stations.layer.layout!['icon-image'], ['image', ['concat', 'sdf:', 'general/station']]);
});

test('adds the language parameter only to sources that support it', () => {
  const prepared = prepare({ language: 'ja,en' });
  assert.match(String(prepared.sources['orm:src:openrailwaymap_stations'].url), /\?lang=ja%2Cen$/);
  assert.doesNotMatch(String(prepared.sources['orm:src:openrailwaymap_platforms'].url), /lang=/);
  assert.equal(prepared.sources['orm:src:openrailwaymap_stations'].metadata, undefined);
});

test('reads state defaults and sprite sheets', () => {
  const prepared = prepare();
  assert.deepEqual(prepared.stateDefaults.pois, ['radio', 'facility']);
  assert.deepEqual(prepared.spriteUrls.map((s) => s.id), ['sdf', 'default']);
});

test('replaces fonts with the game font stacks', () => {
  const prepared = prepare({ fonts: { regular: ['Noto Sans Regular'], bold: ['Noto Sans Bold'] } });
  const stations = prepared.layers.find((l) => l.originalId === 'stations_text')!;
  assert.deepEqual(stations.layer.layout!['text-font'], ['Noto Sans Bold']);
});

test('scales opacity without breaking zoom curves', () => {
  assert.equal(scaleOpacity(undefined, 0.5), 0.5);
  assert.equal(scaleOpacity(0.8, 0.5), 0.4);
  assert.deepEqual(
    scaleOpacity(['interpolate', ['linear'], ['zoom'], 15, 0.2, 17, 0.6], 0.5),
    ['interpolate', ['linear'], ['zoom'], 15, 0.1, 17, 0.3],
  );
  assert.deepEqual(scaleOpacity(['step', ['zoom'], 0, 12, 1], 0.5), ['step', ['zoom'], 0, 12, 0.5]);
  assert.deepEqual(
    scaleOpacity(['case', ['get', 'x'], 1, 0.5], 0.5),
    ['*', ['case', ['get', 'x'], 1, 0.5], 0.5],
  );
  const prepared = prepare();
  const platforms = prepared.layers.find((l) => l.originalId === 'platforms_fill')!;
  const layer = applyOpacity(platforms, 0.5);
  assert.deepEqual(layer.paint!['fill-opacity'], ['interpolate', ['linear'], ['zoom'], 15, 0.1, 17, 0.3]);
  // original definition is not mutated
  assert.deepEqual(platforms.layer.paint!['fill-opacity'], ['interpolate', ['linear'], ['zoom'], 15, 0.2, 17, 0.6]);
});

test('bakes global state into constants for older MapLibre builds', () => {
  const prepared = prepare();
  const stations = prepared.layers.find((l) => l.originalId === 'stations_text')!;
  const baked = bakeGlobalState(stations.layer, { stations: 'none', pois: ['radio'] }, (key) => key.replace(/^orm_/, '')) as typeof stations.layer;
  assert.deepEqual(baked.layout!.visibility, ['case', ['in', 'none', ['literal', ['station', 'operator']]], 'visible', 'none']);
  assert.equal(collectGlobalStateKeys(baked).size, 0);
  assert.deepEqual(
    bakeGlobalState(['in', 'radio', ['global-state', 'orm_pois']], { pois: ['radio'] }, (k) => k.slice(4)),
    ['in', 'radio', ['literal', ['radio']]],
  );
});

test('detects game fonts and theme', () => {
  assert.deepEqual(
    detectGameFonts([
      { type: 'line' },
      { type: 'symbol', layout: { 'text-font': ['Inter Bold'] } },
      { type: 'symbol', layout: { 'text-font': ['Inter Regular'] } },
    ]),
    { regular: ['Inter Regular'], bold: ['Inter Bold'] },
  );
  assert.equal(detectGameFonts([{ type: 'symbol', layout: { 'text-font': ['get', 'font'] } }]), null);
  assert.equal(isDarkColor('#111827'), true);
  assert.equal(isDarkColor('#f8fafc'), false);
  assert.equal(isDarkColor('rgb(20, 20, 20)'), true);
  assert.equal(isDarkColor('hsl(210, 20%, 96%)'), false);
  assert.equal(isDarkColor(['get', 'x']), null);
});

test('settings normalisation rejects junk and presets round-trip', () => {
  const settings = normalizeSettings({
    opacity: 4,
    proxyBaseUrl: 'not a url',
    language: 'en; drop table',
    mapState: { tracks: 'warp-speed', signals: ['main', 'bogus', 'main'], pois: 'nope' },
  });
  assert.equal(settings.opacity, 1);
  assert.equal(settings.proxyBaseUrl, 'http://127.0.0.1:8788');
  assert.equal(settings.language, '');
  assert.equal(settings.mapState.tracks, DEFAULT_MAP_STATE.tracks);
  assert.deepEqual(settings.mapState.signals, ['main']);
  assert.deepEqual(settings.mapState.pois, DEFAULT_MAP_STATE.pois);
  for (const preset of PRESETS) {
    assert.equal(matchPreset({ ...DEFAULT_MAP_STATE, ...preset.state }), preset.id);
  }
});

test('station name language follows the system like openrailwaymap.app, with off and custom modes', async () => {
  const { effectiveLanguage, systemLanguage } = await import('../src/config');
  assert.equal(normalizeSettings({}).languageMode, 'auto');
  assert.equal(effectiveLanguage(normalizeSettings({})), systemLanguage());
  assert.match(systemLanguage(), /^[a-z]{2,3}$/);
  assert.equal(effectiveLanguage(normalizeSettings({ languageMode: 'off', language: 'en' })), '');
  assert.equal(effectiveLanguage(normalizeSettings({ languageMode: 'custom', language: 'ja-Latn,en' })), 'ja-Latn,en');
  // Settings saved by 1.2.x: a typed language becomes custom, an empty one becomes automatic.
  assert.equal(normalizeSettings({ language: 'de' }).languageMode, 'custom');
  assert.equal(normalizeSettings({ language: '' }).languageMode, 'auto');
});
