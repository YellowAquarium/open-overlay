import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser globals for the layer manager.
const g = globalThis as Record<string, unknown>;
g.window = globalThis;
g.document = {
  documentElement: { classList: { contains: () => false } },
  createElement: () => ({ remove() {}, querySelectorAll: () => [], set innerHTML(_v: string) {} }),
};
g.localStorage = { getItem: () => null, setItem: () => undefined };

const style = {
  version: 8,
  sprite: [],
  sources: {
    high: { type: 'vector', url: 'http://p/orm/tilejson/railway_line_high' },
    route: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    dem: { type: 'raster-dem', tiles: ['x'] },
  },
  layers: [
    { id: 'hillshade', type: 'hillshade', source: 'dem' },
    { id: 'line', type: 'line', source: 'high', 'source-layer': 'railway_line_high', paint: { 'line-opacity': 0.8 }, layout: { visibility: ['case', ['==', ['global-state', 'tracks'], 'usage'], 'visible', 'none'] } },
    { id: 'label', type: 'symbol', source: 'high', 'source-layer': 'railway_line_high', layout: { 'text-font': ['Helvetica-Neue'] } },
    { id: 'route', type: 'line', source: 'route' },
  ],
  state: { tracks: { default: 'usage' }, theme: { default: 'light' } },
};

g.fetch = async (url: string) => {
  assert.equal(url, 'http://127.0.0.1:8788/orm/style.json');
  return { ok: true, status: 200, json: async () => structuredClone(style) };
};

function createFakeMap(withGlobalState: boolean) {
  const layers: Array<{ id: string; [k: string]: unknown }> = [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b0f19' } },
    { id: 'water', type: 'fill' },
    { id: 'road-lines', type: 'line' },
    { id: 'construction-tracks-base', type: 'line' },
    { id: 'labels', type: 'symbol', layout: { 'text-font': ['Inter Regular'] } },
  ];
  const sources: Record<string, unknown> = {};
  const globalState: Record<string, unknown> = {};
  const listeners: Record<string, Array<(e?: unknown) => void>> = {};
  const map = {
    layers, sources, globalState, listeners,
    on: (t: string, fn: (e?: unknown) => void) => { (listeners[t] ??= []).push(fn); },
    off: (t: string, fn: (e?: unknown) => void) => { listeners[t] = (listeners[t] ?? []).filter((f) => f !== fn); },
    getSource: (id: string) => (sources[id] ? { setData: (d: unknown) => { (sources[id] as { data?: unknown }).data = d; } } : undefined),
    addSource: (id: string, s: unknown) => { if (sources[id]) throw new Error('dup source'); sources[id] = s; },
    removeSource: (id: string) => { delete sources[id]; },
    getLayer: (id: string) => layers.find((l) => l.id === id),
    addLayer: (layer: { id: string }, beforeId?: string) => {
      if (layers.some((l) => l.id === layer.id)) throw new Error('dup layer');
      const index = beforeId ? layers.findIndex((l) => l.id === beforeId) : -1;
      if (index >= 0) layers.splice(index, 0, layer); else layers.push(layer);
    },
    removeLayer: (id: string) => { layers.splice(layers.findIndex((l) => l.id === id), 1); },
    moveLayer: (id: string, beforeId?: string) => {
      const [layer] = layers.splice(layers.findIndex((l) => l.id === id), 1);
      const index = beforeId ? layers.findIndex((l) => l.id === beforeId) : -1;
      if (index >= 0) layers.splice(index, 0, layer); else layers.push(layer);
    },
    setLayoutProperty: (id: string, prop: string, value: unknown) => {
      const layer = layers.find((l) => l.id === id) as { layout?: Record<string, unknown> };
      layer.layout = { ...(layer.layout ?? {}), [prop]: value };
    },
    getLayoutProperty: (id: string, prop: string) => (layers.find((l) => l.id === id) as { layout?: Record<string, unknown> })?.layout?.[prop],
    setPaintProperty: (id: string, prop: string, value: unknown) => {
      const layer = layers.find((l) => l.id === id) as { paint?: Record<string, unknown> };
      layer.paint = { ...(layer.paint ?? {}), [prop]: value };
    },
    getStyle: () => ({ layers: structuredClone(layers), glyphs: 'https://example/{fontstack}/{range}.pbf' }),
    getLayersOrder: () => layers.map((l) => l.id),
    getPitch: () => 0,
    getBearing: () => 0,
    ...(withGlobalState ? { setGlobalStateProperty: (k: string, v: unknown) => { globalState[k] = v; } } : {}),
  };
  return map;
}

async function setup(withGlobalState: boolean) {
  const { OverlayStore } = await import('../src/store');
  const { OrmLayerManager } = await import('../src/OrmLayerManager');
  const store = new OverlayStore({ storage: { get: async (_k: string, d: unknown) => d, set: async () => undefined } } as never);
  (store as unknown as { proxyHealth: unknown }).proxyHealth = { ok: true, ready: true, status: 'ready' };
  const { MapAttribution } = await import('../src/attribution');
  const manager = new OrmLayerManager(store, new MapAttribution());
  const map = createFakeMap(withGlobalState);
  manager.setMap(map as never);
  return { store, manager, map };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test('adds namespaced sources and layers below the player tracks with native global state', async () => {
  const { store, manager, map } = await setup(true);
  store.updateSettings({ enabled: true });
  manager.setSettings(store.getSettings());
  await settle();

  const ids = map.layers.map((l) => l.id);
  assert.deepEqual(ids, ['background', 'water', 'road-lines', 'open-overlay:line', 'open-overlay:label', 'open-overlay:route', 'construction-tracks-base', 'labels']);
  assert.deepEqual(Object.keys(map.sources).sort(), ['open-overlay:src:high', 'open-overlay:src:route']);
  assert.equal(map.globalState.orm_tracks, 'usage');
  assert.equal(map.globalState.orm_theme, 'dark', 'auto theme follows the dark game background');
  const label = map.layers.find((l) => l.id === 'open-overlay:label') as unknown as { layout: Record<string, unknown> };
  assert.deepEqual(label.layout['text-font'], ['Inter Regular'], 'uses the game font stack');
  assert.equal(store.getSnapshot().layerStatus.phase, 'ready');

  // Changing map state only updates global state - no re-add.
  store.updateSettings({ mapState: { ...store.getSettings().mapState, tracks: 'speed' }, opacity: 0.5 });
  manager.setSettings(store.getSettings());
  await settle();
  assert.equal(map.globalState.orm_tracks, 'speed');
  const line = map.layers.find((l) => l.id === 'open-overlay:line') as unknown as { paint: Record<string, unknown> };
  assert.equal(line.paint['line-opacity'], 0.4);

  // Game rebuilds its style: our layers disappear and come back.
  map.layers.splice(0, map.layers.length, { id: 'background', type: 'background' }, { id: 'construction-tracks-base', type: 'line' });
  for (const key of Object.keys(map.sources)) delete map.sources[key];
  map.listeners.styledata.forEach((fn) => fn());
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.ok(map.layers.some((l) => l.id === 'open-overlay:line'));

  // Turning off removes everything we added.
  store.updateSettings({ enabled: false });
  manager.setSettings(store.getSettings());
  await settle();
  assert.equal(map.layers.filter((l) => l.id.startsWith('open-overlay:')).length, 0);
  assert.equal(Object.keys(map.sources).length, 0);
  manager.destroy();
});

test('bakes state into layers when the game MapLibre lacks global state', async () => {
  const { store, manager, map } = await setup(false);
  store.updateSettings({ enabled: true, aboveTracks: true });
  manager.setSettings(store.getSettings());
  await settle();
  const line = map.layers.find((l) => l.id === 'open-overlay:line') as unknown as { layout: Record<string, unknown> };
  assert.deepEqual(line.layout.visibility, ['case', ['==', 'usage', 'usage'], 'visible', 'none']);
  // Above tracks: directly above the game's top track layer.
  const ids = () => map.layers.map((l) => l.id);
  assert.equal(ids()[ids().indexOf('construction-tracks-base') + 1], 'open-overlay:line');
  assert.equal(ids()[ids().indexOf('open-overlay:route') + 1], 'labels');
  assert.equal(store.getSnapshot().layerStatus.globalStateMode, 'baked');

  store.updateSettings({ mapState: { ...store.getSettings().mapState, tracks: 'gauge' } });
  manager.setSettings(store.getSettings());
  await settle();
  const rebuilt = map.layers.find((l) => l.id === 'open-overlay:line') as unknown as { layout: Record<string, unknown> };
  assert.deepEqual(rebuilt.layout.visibility, ['case', ['==', 'gauge', 'usage'], 'visible', 'none']);
  manager.destroy();
});

test('satellite imagery covers the ground layers when hiding the base map, and restores it', async () => {
  const { OverlayStore } = await import('../src/store');
  const { SatelliteLayerManager } = await import('../src/SatelliteLayerManager');
  const { MapAttribution } = await import('../src/attribution');
  const store = new OverlayStore({ storage: { get: async (_k: string, d: unknown) => d, set: async () => undefined } } as never);
  (store as unknown as { proxyHealth: unknown }).proxyHealth = {
    ok: true, ready: true, status: 'ready',
    satelliteProviders: [
      { id: 'google-sat', label: 'Google', attribution: 'Imagery © Google', tileSize: 256, maxZoom: 20, configured: true, requires: null },
      { id: 'google', label: 'Google API', attribution: 'Google Maps', tileSize: 256, maxZoom: 21, configured: false, requires: 'GOOGLE_MAPS_API_KEY' },
    ],
  };
  const map = createFakeMap(true);
  const sat = new SatelliteLayerManager(store, new MapAttribution());
  sat.setMap(map as never);
  store.updateSettings({ satellite: { ...store.getSettings().satellite, enabled: true, opacity: 0.7, provider: 'google-sat' } });
  sat.setSettings(store.getSettings());

  const satIndex = () => map.layers.findIndex((l) => l.id === 'open-overlay:satellite-layer');
  const indexOf = (id: string) => map.layers.findIndex((l) => l.id === id);
  // Above water and roads (so the game re-showing water can't show through), below the player's tracks.
  assert.ok(satIndex() > indexOf('water') && satIndex() > indexOf('road-lines'));
  assert.equal(satIndex(), indexOf('construction-tracks-base') - 1);
  assert.deepEqual((map.sources['open-overlay:satellite-source'] as { tiles: string[] }).tiles, ['http://127.0.0.1:8788/sat/google-sat/{z}/{x}/{y}']);
  const water = () => (map.layers.find((l) => l.id === 'water') as { layout?: Record<string, unknown> }).layout?.visibility;
  assert.equal(water(), 'none');

  // A provider whose key is missing is not shown.
  store.updateSettings({ satellite: { ...store.getSettings().satellite, provider: 'google' } });
  sat.setSettings(store.getSettings());
  assert.ok(!map.layers.some((l) => l.id === 'open-overlay:satellite-layer'));
  assert.equal(water(), 'visible');

  store.updateSettings({ satellite: { ...store.getSettings().satellite, provider: 'google-sat', hideBaseMap: false } });
  sat.setSettings(store.getSettings());
  assert.ok(map.layers.some((l) => l.id === 'open-overlay:satellite-layer'));
  assert.equal(water(), 'visible');
  // Keeping the base map puts the imagery underneath it.
  assert.equal(satIndex(), indexOf('water') - 1);

  // The game insists on showing water: after a few rounds we stop toggling it (no flicker).
  store.updateSettings({ satellite: { ...store.getSettings().satellite, hideBaseMap: true } });
  sat.setSettings(store.getSettings());
  let toggles = 0;
  for (let round = 0; round < 6; round += 1) {
    map.setLayoutProperty('water', 'visibility', 'visible');
    sat.setSettings(store.getSettings());
    if (water() === 'none') toggles += 1;
  }
  assert.ok(toggles <= 2, `re-hid water ${toggles} times`);
  assert.equal(water(), 'visible');
  assert.ok(satIndex() > indexOf('water'), 'imagery still covers the water');
  sat.destroy();
  assert.ok(!map.layers.some((l) => l.id === 'open-overlay:satellite-layer'));
});

test('retired imagery choices fall back to the default', async () => {
  const { normalizeSatellite } = await import('../src/config');
  assert.equal(normalizeSatellite({ provider: 'esri' }).provider, 'google-sat');
  assert.equal(normalizeSatellite({ provider: 'eox-s2' }).provider, 'google-sat');
  assert.equal(normalizeSatellite({ provider: 'osm' }).provider, 'osm');
  assert.equal(normalizeSatellite({ provider: 'maptiler' }).provider, 'google-sat');
});

test('above-tracks overlay stays on top when the build menu adds blueprint track layers', async () => {
  const { store, manager, map } = await setup(true);
  store.updateSettings({ enabled: true, aboveTracks: true });
  manager.setSettings(store.getSettings());
  await settle();
  // Build mode: the game adds its preview tracks above everything else.
  map.layers.push({ id: 'blueprint-tracks', type: 'line' }, { id: 'blueprint-tracks-casing', type: 'line' });
  map.listeners.styledata.forEach((fn) => fn());
  await new Promise((resolve) => setTimeout(resolve, 250));
  const ids = map.layers.map((l) => l.id);
  const firstOurs = ids.findIndex((id) => id.startsWith('open-overlay:'));
  assert.ok(firstOurs > ids.indexOf('blueprint-tracks-casing'), ids.join(', '));
  manager.destroy();
});

test('reloadTiles uses refreshTiles when the map has it, else reloads the source', async () => {
  const { reloadTiles } = await import('../src/OrmLayerManager');
  const calls: unknown[] = [];
  reloadTiles({ refreshTiles: (id: string, tiles: unknown) => calls.push([id, tiles]) } as any, 'src', [{ x: 1, y: 2, z: 3 }]);
  assert.deepEqual(calls, [['src', [{ x: 1, y: 2, z: 3 }]]]);
  let reloaded = 0;
  reloadTiles({ style: { sourceCaches: { src: { reload: () => { reloaded += 1; } } } } } as any, 'src', [{ x: 1, y: 2, z: 3 }]);
  assert.equal(reloaded, 1);
});
