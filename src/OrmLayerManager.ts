import { MOD_ID, TAG, effectiveLanguage, type OverlaySettings } from './config';
import type { InspectedFeature, OverlayStore } from './store';
import {
  applyOpacity,
  bakeGlobalState,
  detectGameFonts,
  isDarkColor,
  namespacedSourceId,
  opacityPaintValues,
  prepareStyle,
  type OrmStyle,
  type PreparedLayer,
  type PreparedStyle,
  type StyleLayer,
} from './style/prepare';
import { SpriteLibrary } from './style/sprites';
import type { MapAttribution } from './attribution';

/** Loose MapLibre map surface used by the overlay (keeps us independent of the game's exact version). */
export type MapLike = {
  on: (type: string, listener: (event?: any) => void) => void;
  off: (type: string, listener: (event?: any) => void) => void;
  getSource: (id: string) => any;
  addSource: (id: string, source: Record<string, unknown>) => void;
  removeSource: (id: string) => void;
  getLayer: (id: string) => unknown;
  addLayer: (layer: Record<string, unknown>, beforeId?: string) => void;
  removeLayer: (id: string) => void;
  moveLayer: (id: string, beforeId?: string) => void;
  setPaintProperty: (layerId: string, name: string, value: unknown) => void;
  setLayoutProperty?: (layerId: string, name: string, value: unknown) => void;
  getLayoutProperty?: (layerId: string, name: string) => unknown;
  getStyle: () => { layers?: Array<{ id: string; type?: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> }>; glyphs?: string };
  getLayersOrder?: () => string[];
  hasImage?: (id: string) => boolean;
  addImage?: (id: string, image: unknown, options?: unknown) => void;
  setGlobalStateProperty?: (name: string, value: unknown) => void;
  queryRenderedFeatures?: (geometry: unknown, options?: { layers?: string[] }) => any[];
  getBearing?: () => number;
  getPitch?: () => number;
  flyTo?: (options: Record<string, unknown>) => void;
  getContainer?: () => HTMLElement;
  getCanvas?: () => HTMLCanvasElement;
  triggerRepaint?: () => void;
  style?: { addLayer?: (layer: unknown, before?: string, options?: unknown) => void };
  _update?: (updateStyle?: boolean) => void;
};

const NS = MOD_ID;
const STATE_PREFIX = 'orm_';
const ORM_ATTRIBUTION = 'Railway data: <a href="https://openrailwaymap.app" target="_blank" rel="noreferrer">OpenRailwayMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';
const SPRITE_RETRY_MS = 30000;
const PITCH_LIMIT = 30;
/** Game layers used to slot the overlay just below / just above the player's tracks. */
const ANCHOR_BELOW_TRACKS = ['construction-tracks-base', 'tracks-base', 'tracks'];
const ANCHOR_ABOVE_TRACKS = ['building-collision', 'stations', 'station-labels'];

export class OrmLayerManager {
  private map: MapLike | null = null;
  private settings: OverlaySettings | null = null;
  private sprites = new SpriteLibrary();
  private rawStyle: { base: string; style: OrmStyle } | null = null;
  private prepared: PreparedStyle | null = null;
  private preparedKey: string | null = null;
  private onMapKey: string | null = null;
  private appliedState = new Map<string, string>();
  private appliedOpacity: number | null = null;
  private syncToken = 0;
  private checkTimer: number | null = null;
  private viewTimer: number | null = null;
  private failedLayerIds = new Set<string>();
  private handlers: Array<[string, (event?: any) => void]> = [];
  private lastPitched = false;
  private lastSpriteAttempt = 0;

  constructor(private readonly store: OverlayStore, private readonly attribution: MapAttribution) {}

  setMap(map: MapLike): void {
    if (this.map === map) return;
    this.detach();
    this.map = map;
    this.attach();
    void this.sync();
  }

  setSettings(settings: OverlaySettings): void {
    this.settings = settings;
    void this.sync();
  }

  destroy(): void {
    this.removeFromMap();
    this.detach();
    this.map = null;
  }

  // ------------------------------------------------------------------------
  // Public helpers used by the panel
  // ------------------------------------------------------------------------

  async loadFeatureDetails(feature: InspectedFeature): Promise<void> {
    if (!this.settings || feature.id === null || !feature.sourceLayer) return;
    const key = featureKey(feature);
    this.store.setDetails(key, { loading: true, error: null, properties: null });
    try {
      const language = effectiveLanguage(this.settings);
      const lang = language ? `?lang=${encodeURIComponent(language)}` : '';
      const url = `${this.settings.proxyBaseUrl}/orm/api/feature/${encodeURIComponent(feature.source)}/${encodeURIComponent(feature.sourceLayer)}/${encodeURIComponent(String(feature.id))}${lang}`;
      const response = await fetch(url);
      if (response.status === 404) {
        this.store.setDetails(key, { loading: false, error: 'No extra details for this feature', properties: null });
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { properties?: Record<string, unknown> } | null;
      this.store.setDetails(key, { loading: false, error: null, properties: payload?.properties ?? {} });
    } catch (error) {
      this.store.setDetails(key, { loading: false, error: error instanceof Error ? error.message : 'Failed to load', properties: null });
    }
  }

  /** Throws away the cached style and sprites and rebuilds the overlay (e.g. after restarting the proxy). */
  reload(): void {
    this.removeFromMap();
    this.rawStyle = null;
    this.prepared = null;
    this.preparedKey = null;
    this.sprites = new SpriteLibrary();
    void this.sync();
  }

  showRoute(route: { id: string; label: string; color: string | null } | null): void {
    this.store.setActiveRoute(route);
    this.applyRouteData();
  }

  flyTo(longitude: number, latitude: number, zoom = 15): void {
    this.map?.flyTo?.({ center: [longitude, latitude], zoom, essential: true });
  }

  // ------------------------------------------------------------------------
  // Sync pipeline
  // ------------------------------------------------------------------------

  private async sync(): Promise<void> {
    const map = this.map;
    const settings = this.settings;
    if (!map || !settings) return;
    const token = ++this.syncToken;

    if (!settings.enabled || !this.store.isProxyReady()) {
      this.removeFromMap();
      this.store.setLayerStatus({
        phase: 'idle',
        message: settings.enabled ? 'Waiting for proxy' : 'Overlay off',
        layerCount: 0,
        failedLayers: 0,
      });
      return;
    }

    try {
      const prepared = await this.ensurePrepared(settings);
      if (token !== this.syncToken || !prepared) return;
      this.ensureOnMap(prepared, settings);
    } catch (error) {
      if (token !== this.syncToken) return;
      console.error(`${TAG} Failed to load OpenRailwayMap style`, error);
      this.removeFromMap();
      this.store.setLayerStatus({
        phase: 'error',
        message: `Could not load OpenRailwayMap: ${error instanceof Error ? error.message : String(error)}`,
        layerCount: 0,
      });
    }
  }

  private async ensurePrepared(settings: OverlaySettings): Promise<PreparedStyle | null> {
    const fonts = this.resolveFonts();
    const language = effectiveLanguage(settings);
    const key = `${settings.proxyBaseUrl}|${language}|${JSON.stringify(fonts)}`;
    if (this.prepared && this.preparedKey === key) {
      if (this.sprites.size === 0 && this.prepared.spriteUrls.length && Date.now() - this.lastSpriteAttempt > SPRITE_RETRY_MS) {
        // Icons (station dots, signals...) failed earlier - try again and rebuild so tiles pick them up.
        if (await this.loadSprites(this.prepared)) this.onMapKey = null;
      }
      return this.prepared;
    }

    this.store.setLayerStatus({ phase: 'loading', message: 'Loading OpenRailwayMap style…' });

    if (!this.rawStyle || this.rawStyle.base !== settings.proxyBaseUrl) {
      const response = await fetch(`${settings.proxyBaseUrl}/orm/style.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`style.json returned HTTP ${response.status}`);
      this.rawStyle = { base: settings.proxyBaseUrl, style: await response.json() as OrmStyle };
    }

    const prepared = prepareStyle(this.rawStyle.style, {
      namespace: NS,
      globalStateKey: (key) => `${STATE_PREFIX}${key}`,
      language,
      fonts,
    });

    this.store.setLayerStatus({ phase: 'loading', message: 'Loading OpenRailwayMap symbols…' });
    await this.loadSprites(prepared);

    this.prepared = prepared;
    this.preparedKey = key;
    this.onMapKey = null;
    return prepared;
  }

  private async loadSprites(prepared: PreparedStyle): Promise<boolean> {
    this.lastSpriteAttempt = Date.now();
    try {
      await this.sprites.load(prepared.spriteUrls);
      return this.sprites.size > 0;
    } catch (error) {
      console.warn(`${TAG} Sprite sheets failed to load; icons (station dots, signals) will be missing until they load`, error);
      return false;
    }
  }

  private ensureOnMap(prepared: PreparedStyle, settings: OverlaySettings): void {
    const map = this.map;
    if (!map) return;

    const nativeState = typeof map.setGlobalStateProperty === 'function';
    const state = this.computeState(prepared, settings, nativeState);
    const structureKey = [
      this.preparedKey,
      settings.aboveTracks,
      nativeState ? 'native' : `baked:${JSON.stringify(state)}|${settings.opacity}`,
    ].join('|');

    const missing = !this.allOnMap(prepared);
    if (structureKey !== this.onMapKey || missing) {
      this.removeFromMap();
      this.appliedState.clear();
      if (nativeState) this.applyGlobalState(state);
      this.addToMap(prepared, settings, nativeState ? null : state);
      this.onMapKey = structureKey;
      this.appliedOpacity = settings.opacity;
      this.applyRouteData();
      this.store.setLayerStatus({
        phase: 'ready',
        message: this.failedLayerIds.size
          ? `Showing ${prepared.layers.length - this.failedLayerIds.size} layers (${this.failedLayerIds.size} unsupported by this game version)`
          : `Showing ${prepared.layers.length} OpenRailwayMap layers`,
        layerCount: prepared.layers.length - this.failedLayerIds.size,
        failedLayers: this.failedLayerIds.size,
        globalStateMode: nativeState ? 'native' : 'baked',
      });
    } else {
      if (nativeState) this.applyGlobalState(state);
      if (this.appliedOpacity !== settings.opacity) {
        this.applyOpacityToMap(prepared, settings.opacity);
        this.appliedOpacity = settings.opacity;
      }
      this.ensureOrder(prepared, settings);
    }
    this.updateAttribution(true);
  }

  private computeState(prepared: PreparedStyle, settings: OverlaySettings, nativeState: boolean): Record<string, unknown> {
    const pitch = this.map?.getPitch?.() ?? 0;
    const pitched = nativeState && pitch > PITCH_LIMIT;
    this.lastPitched = pitched;
    return {
      ...prepared.stateDefaults,
      ...settings.mapState,
      theme: this.resolveTheme(settings),
      bearing: nativeState ? (this.map?.getBearing?.() ?? 0) : 0,
      pitched,
      allDates: false,
      openHistoricalMap: false,
      hillshade: false,
    };
  }

  private applyGlobalState(state: Record<string, unknown>): void {
    const map = this.map;
    if (!map?.setGlobalStateProperty) return;
    for (const [key, value] of Object.entries(state)) {
      const serialized = JSON.stringify(value ?? null);
      if (this.appliedState.get(key) === serialized) continue;
      try {
        map.setGlobalStateProperty(`${STATE_PREFIX}${key}`, value ?? null);
        this.appliedState.set(key, serialized);
      } catch (error) {
        console.warn(`${TAG} Failed to set map state ${key}`, error);
      }
    }
  }

  private addToMap(prepared: PreparedStyle, settings: OverlaySettings, bakedState: Record<string, unknown> | null): void {
    const map = this.map;
    if (!map) return;
    this.failedLayerIds.clear();

    for (const [id, source] of Object.entries(prepared.sources)) {
      if (map.getSource(id)) continue;
      try {
        map.addSource(id, source);
      } catch (error) {
        console.warn(`${TAG} Failed to add source ${id}`, error);
      }
    }

    const beforeId = this.resolveBeforeId(settings);
    let logged = 0;
    for (const prepared_ of prepared.layers) {
      if (map.getLayer(prepared_.id)) continue;
      let layer: StyleLayer = applyOpacity(prepared_, settings.opacity);
      if (bakedState) {
        layer = bakeGlobalState(layer, bakedState, (key) => key.slice(STATE_PREFIX.length)) as StyleLayer;
      }
      if (!this.addLayer(layer, beforeId)) {
        this.failedLayerIds.add(prepared_.id);
        if (logged < 5) {
          logged += 1;
          console.warn(`${TAG} Layer ${prepared_.originalId} could not be added`);
        }
      }
    }
    console.log(`${TAG} Added ${prepared.layers.length - this.failedLayerIds.size}/${prepared.layers.length} layers (${bakedState ? 'baked' : 'native'} state), before ${beforeId ?? 'top'}`);
  }

  private addLayer(layer: StyleLayer, beforeId: string | undefined): boolean {
    const map = this.map;
    if (!map) return false;
    try {
      map.addLayer(layer, beforeId);
      return true;
    } catch (firstError) {
      // Some OpenRailwayMap layers use spec features newer than strict validation
      // allows; openrailwaymap.app itself loads its style with validation off.
      try {
        if (!map.style?.addLayer) throw firstError;
        map.style.addLayer(layer, beforeId, { validate: false });
        map._update?.(true);
        return Boolean(map.getLayer(layer.id));
      } catch {
        return false;
      }
    }
  }

  private applyOpacityToMap(prepared: PreparedStyle, opacity: number): void {
    const map = this.map;
    if (!map) return;
    for (const layer of prepared.layers) {
      if (!map.getLayer(layer.id)) continue;
      for (const [prop, value] of Object.entries(opacityPaintValues(layer, opacity))) {
        try {
          map.setPaintProperty(layer.id, prop, value);
        } catch {
          // ignore individual failures
        }
      }
    }
  }

  private removeFromMap(): void {
    const map = this.map;
    const prepared = this.prepared;
    this.onMapKey = null;
    this.appliedOpacity = null;
    this.updateAttribution(false);
    if (!map || !prepared) return;
    for (let i = prepared.layers.length - 1; i >= 0; i -= 1) {
      const id = prepared.layers[i].id;
      try {
        if (map.getLayer(id)) map.removeLayer(id);
      } catch {
        // ignore
      }
    }
    for (const id of Object.keys(prepared.sources)) {
      try {
        if (map.getSource(id)) map.removeSource(id);
      } catch {
        // ignore
      }
    }
  }

  private allOnMap(prepared: PreparedStyle): boolean {
    const map = this.map;
    if (!map) return false;
    const sample = prepared.layers.filter((layer) => !this.failedLayerIds.has(layer.id));
    if (!sample.length) return false;
    // Cheap check: first, middle and last layer plus every source.
    const probe = [sample[0], sample[Math.floor(sample.length / 2)], sample[sample.length - 1]];
    return probe.every((layer) => Boolean(map.getLayer(layer.id))) &&
      Object.keys(prepared.sources).every((id) => Boolean(map.getSource(id)));
  }

  private ensureOrder(prepared: PreparedStyle, settings: OverlaySettings): void {
    const map = this.map;
    if (!map) return;
    const beforeId = this.resolveBeforeId(settings);
    const order = this.getLayerOrder();
    if (!order.length) return;
    const ours = prepared.layers.filter((layer) => !this.failedLayerIds.has(layer.id)).map((layer) => layer.id);
    if (!ours.length) return;
    const lastIndex = order.indexOf(ours[ours.length - 1]);
    const firstIndex = order.indexOf(ours[0]);
    if (lastIndex < 0 || firstIndex < 0) return;
    const contiguous = lastIndex - firstIndex === ours.length - 1;
    const anchored = beforeId ? order.indexOf(beforeId) === lastIndex + 1 : lastIndex === order.length - 1;
    if (contiguous && anchored) return;
    for (const id of ours) {
      try {
        map.moveLayer(id, beforeId);
      } catch {
        // ignore
      }
    }
  }

  private getLayerOrder(): string[] {
    const map = this.map;
    if (!map) return [];
    try {
      if (map.getLayersOrder) return map.getLayersOrder();
      return map.getStyle().layers?.map((layer) => layer.id) ?? [];
    } catch {
      return [];
    }
  }

  private resolveBeforeId(settings: OverlaySettings): string | undefined {
    const order = this.getLayerOrder();
    const candidates = settings.aboveTracks ? ANCHOR_ABOVE_TRACKS : ANCHOR_BELOW_TRACKS;
    const found = candidates.find((id) => order.includes(id));
    if (found) return found;
    if (settings.aboveTracks) return undefined;
    // Below tracks but no known anchor: put the overlay under the first game symbol layer.
    const style = this.safeStyleLayers();
    const firstSymbol = style.find((layer) => layer.type === 'symbol' && !layer.id.startsWith(`${NS}:`));
    return firstSymbol?.id;
  }

  private safeStyleLayers(): Array<{ id: string; type?: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> }> {
    try {
      return this.map?.getStyle().layers ?? [];
    } catch {
      return [];
    }
  }

  private resolveFonts(): { regular: string[]; bold: string[] } | null {
    const map = this.map;
    if (!map) return null;
    let glyphs: string | undefined;
    try {
      glyphs = map.getStyle().glyphs;
    } catch {
      return null;
    }
    // Without a glyph server MapLibre renders labels with local fonts, so keep OpenRailwayMap's stacks.
    if (!glyphs) return null;
    return detectGameFonts(this.safeStyleLayers().filter((layer) => !layer.id.startsWith(`${NS}:`)));
  }

  private resolveTheme(settings: OverlaySettings): 'light' | 'dark' {
    if (settings.theme !== 'auto') return settings.theme;
    const background = this.safeStyleLayers().find((layer) => layer.type === 'background');
    const dark = isDarkColor(background?.paint?.['background-color']);
    if (dark !== null) return dark ? 'dark' : 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  private applyRouteData(): void {
    const map = this.map;
    const settings = this.settings;
    if (!map || !settings) return;
    const route = this.store.getSnapshot().activeRoute;
    const empty = { type: 'FeatureCollection', features: [] };
    const routeSource = map.getSource(namespacedSourceId(NS, 'route'));
    const stopsSource = map.getSource(namespacedSourceId(NS, 'route_stops'));
    try {
      routeSource?.setData?.(route ? `${settings.proxyBaseUrl}/orm/api/route/${encodeURIComponent(route.id)}` : empty);
      stopsSource?.setData?.(route ? `${settings.proxyBaseUrl}/orm/api/route/stops/${encodeURIComponent(route.id)}` : empty);
    } catch (error) {
      console.warn(`${TAG} Failed to show route`, error);
    }
  }

  // ------------------------------------------------------------------------
  // Map events
  // ------------------------------------------------------------------------

  private attach(): void {
    const map = this.map;
    if (!map) return;
    const on = (type: string, handler: (event?: any) => void) => {
      map.on(type, handler);
      this.handlers.push([type, handler]);
    };

    on('styledata', () => this.scheduleCheck());
    on('styleimagemissing', (event?: { id?: string }) => this.provideImage(event?.id));
    on('rotate', () => this.scheduleViewState());
    on('pitch', () => this.scheduleViewState());
    on('click', (event?: { point?: { x: number; y: number } }) => this.inspect(event?.point));
  }

  private detach(): void {
    const map = this.map;
    if (map) {
      for (const [type, handler] of this.handlers) map.off(type, handler);
    }
    this.handlers = [];
    if (this.checkTimer !== null) window.clearTimeout(this.checkTimer);
    if (this.viewTimer !== null) window.clearTimeout(this.viewTimer);
    this.checkTimer = null;
    this.viewTimer = null;
    this.updateAttribution(false);
  }

  /** The game rebuilds its style from time to time; put our layers back when that happens. */
  private scheduleCheck(): void {
    if (this.checkTimer !== null) return;
    this.checkTimer = window.setTimeout(() => {
      this.checkTimer = null;
      const settings = this.settings;
      const prepared = this.prepared;
      if (!settings?.enabled || !prepared || !this.store.isProxyReady()) return;
      if (!this.allOnMap(prepared)) {
        this.onMapKey = null;
        this.ensureOnMap(prepared, settings);
      } else {
        this.ensureOrder(prepared, settings);
      }
    }, 150);
  }

  private scheduleViewState(): void {
    if (this.viewTimer !== null) return;
    this.viewTimer = window.setTimeout(() => {
      this.viewTimer = null;
      const map = this.map;
      if (!map?.setGlobalStateProperty || !this.onMapKey) return;
      const pitched = (map.getPitch?.() ?? 0) > PITCH_LIMIT;
      const changes: Record<string, unknown> = { bearing: map.getBearing?.() ?? 0 };
      if (pitched !== this.lastPitched) {
        changes.pitched = pitched;
        this.lastPitched = pitched;
      }
      // Bearing only matters for direction-aware signals in pitched views.
      if (!pitched && !('pitched' in changes)) return;
      this.applyGlobalState(changes);
    }, 120);
  }

  private provideImage(id: string | undefined): void {
    const map = this.map;
    if (!map || !id || !this.sprites.has(id) || !map.addImage) return;
    if (map.hasImage?.(id)) return;
    const image = this.sprites.get(id);
    if (!image) return;
    try {
      map.addImage(id, image.data, image.options);
    } catch (error) {
      console.warn(`${TAG} Failed to add icon ${id}`, error);
    }
  }

  private inspect(point: { x: number; y: number } | undefined): void {
    const map = this.map;
    const prepared = this.prepared;
    if (!map || !prepared || !point || !this.settings?.enabled || !this.settings.inspectOnClick || !map.queryRenderedFeatures) return;
    const byId = new Map<string, PreparedLayer>(prepared.layers.map((layer) => [layer.id, layer]));
    const layers = prepared.layers
      .filter((layer) => !this.failedLayerIds.has(layer.id) && map.getLayer(layer.id))
      .map((layer) => layer.id);
    if (!layers.length) return;

    let features: any[] = [];
    try {
      const box = [[point.x - 5, point.y - 5], [point.x + 5, point.y + 5]];
      features = map.queryRenderedFeatures(box, { layers });
    } catch (error) {
      console.warn(`${TAG} Feature query failed`, error);
      return;
    }

    const seen = new Set<string>();
    const result: InspectedFeature[] = [];
    for (const feature of features) {
      const layer = byId.get(feature.layer?.id);
      if (!layer) continue;
      const item: InspectedFeature = {
        layerId: layer.id,
        originalLayerId: layer.originalId,
        source: layer.originalSource,
        sourceLayer: feature.sourceLayer ?? null,
        id: feature.id ?? feature.properties?.id ?? null,
        properties: { ...(feature.properties ?? {}) },
      };
      const key = `${item.source}|${item.sourceLayer}|${item.id ?? JSON.stringify(item.properties)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
      if (result.length >= 8) break;
    }
    this.store.setInspected(result);
  }

  private updateAttribution(visible: boolean): void {
    this.attribution.setContainer(this.map?.getContainer?.() ?? null);
    this.attribution.set('orm', visible ? ORM_ATTRIBUTION : null);
  }
}

export function featureKey(feature: InspectedFeature): string {
  return `${feature.source}|${feature.sourceLayer}|${feature.id}`;
}
