import { GAME_BASE_MAP_LAYERS, MOD_ID, TAG, type OverlaySettings } from './config';
import type { MapLike } from './OrmLayerManager';
import type { OverlayStore, SatelliteProvider } from './store';
import { escapeHtml, type MapAttribution } from './attribution';

const SOURCE_ID = `${MOD_ID}:satellite-source`;
const LAYER_ID = `${MOD_ID}:satellite-layer`;
/** If none of the game's base-map layers exist, slot the imagery under these game layers. */
const FALLBACK_ANCHORS = ['track-elevations', 'tracks', 'blueprint-tracks', 'stations', 'station-labels', 'routes', 'trains', 'demand-points'];
/** Base-map layers that are drawn as ground (not labels / 3D buildings); imagery can safely sit above them. */
const GROUND_LAYERS = GAME_BASE_MAP_LAYERS.filter((id) => !/labels|buildings-3d/.test(id));
/** If the game re-shows a layer we hid this many times within FIGHT_WINDOW_MS, stop fighting over it. */
const FIGHT_LIMIT = 3;
const FIGHT_WINDOW_MS = 10000;

/**
 * Satellite / aerial imagery under the railway overlay, streamed through the same local proxy.
 * Optionally hides the game's own base map (buildings, water, parks, roads...) so the imagery
 * is visible, and restores it when imagery is turned off.
 */
export class SatelliteLayerManager {
  private map: MapLike | null = null;
  private settings: OverlaySettings | null = null;
  private sourceKey: string | null = null;
  private hiddenGameLayers = new Set<string>();
  /** Layers the game keeps turning back on: we leave their visibility alone and rely on stacking instead. */
  private gameControlled = new Set<string>();
  private reshowTimes = new Map<string, number[]>();
  private loggedAnchor: string | null = null;
  private handlers: Array<[string, (event?: any) => void]> = [];
  private checkTimer: number | null = null;
  private viewportTimer: number | null = null;
  private viewportToken = 0;
  private lastViewportKey: string | null = null;

  constructor(private readonly store: OverlayStore, private readonly attribution: MapAttribution) {}

  setMap(map: MapLike): void {
    if (this.map === map) return;
    this.detach();
    this.map = map;
    const onStyle = () => this.scheduleCheck();
    map.on('styledata', onStyle);
    this.handlers.push(['styledata', onStyle]);
    const onMove = () => this.scheduleViewportAttribution();
    map.on('moveend', onMove);
    this.handlers.push(['moveend', onMove]);
    this.sync();
  }

  setSettings(settings: OverlaySettings): void {
    this.settings = settings;
    this.sync();
  }

  destroy(): void {
    this.remove();
    this.restoreBaseMap();
    this.detach();
    this.map = null;
  }

  private detach(): void {
    if (this.map) for (const [type, handler] of this.handlers) this.map.off(type, handler);
    this.handlers = [];
    if (this.checkTimer !== null) window.clearTimeout(this.checkTimer);
    if (this.viewportTimer !== null) window.clearTimeout(this.viewportTimer);
    this.checkTimer = null;
    this.viewportTimer = null;
  }

  private scheduleCheck(): void {
    if (this.checkTimer !== null) return;
    this.checkTimer = window.setTimeout(() => {
      this.checkTimer = null;
      this.sync();
    }, 150);
  }

  private activeProvider(): SatelliteProvider | null {
    const settings = this.settings;
    if (!settings?.satellite.enabled) return null;
    const provider = this.store.getSatelliteProviders().find((candidate) => candidate.id === settings.satellite.provider);
    if (!provider?.configured || !this.store.isProxyReady()) return null;
    return provider;
  }

  private tileUrl(provider: SatelliteProvider, settings: OverlaySettings): string {
    return `${settings.proxyBaseUrl}/sat/${provider.id}/{z}/{x}/{y}`;
  }

  private sync(): void {
    const map = this.map;
    const settings = this.settings;
    if (!map || !settings) return;
    const provider = this.activeProvider();

    if (!provider) {
      this.remove();
      this.restoreBaseMap();
      this.attribution.set('satellite', null);
      this.lastViewportKey = null;
      return;
    }

    const tileUrl = this.tileUrl(provider, settings);
    const key = `${tileUrl}|${provider.tileSize}|${provider.maxZoom}`;
    if (this.sourceKey !== key) this.remove();

    try {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: provider.tileSize,
          maxzoom: provider.maxZoom,
        });
        this.sourceKey = key;
      }
      const beforeId = this.resolveBeforeId(settings.satellite.hideBaseMap);
      const anchorNote = `${settings.satellite.hideBaseMap ? 'above' : 'below'} game base map, before ${beforeId ?? 'top'}`;
      if (this.loggedAnchor !== anchorNote) {
        this.loggedAnchor = anchorNote;
        console.info(`${TAG} Satellite imagery placed ${anchorNote}`);
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: 'raster',
          source: SOURCE_ID,
          paint: { 'raster-opacity': settings.satellite.opacity, 'raster-fade-duration': 150 },
        }, beforeId);
      } else {
        map.setPaintProperty(LAYER_ID, 'raster-opacity', settings.satellite.opacity);
        this.keepInPlace(beforeId);
      }
    } catch (error) {
      console.warn(`${TAG} Failed to show satellite imagery`, error);
    }

    if (settings.satellite.hideBaseMap) this.hideBaseMap();
    else this.restoreBaseMap();

    this.attribution.setContainer(map.getContainer?.() ?? null);
    if (provider.dynamicAttribution) {
      // Show the provider mark straight away; the area-specific credit follows.
      if (this.lastViewportKey === null) this.attribution.set('satellite', escapeHtml(provider.attribution));
      this.scheduleViewportAttribution();
    } else {
      this.lastViewportKey = null;
      this.attribution.set('satellite', escapeHtml(provider.attribution));
    }
  }

  /**
   * Google's Map Tiles API requires showing "Google Maps" plus the copyright text for the
   * current view, which comes from its viewport endpoint (via the proxy, which holds the key).
   */
  private scheduleViewportAttribution(): void {
    if (this.viewportTimer !== null) window.clearTimeout(this.viewportTimer);
    this.viewportTimer = window.setTimeout(() => {
      this.viewportTimer = null;
      void this.updateViewportAttribution();
    }, 400);
  }

  private async updateViewportAttribution(): Promise<void> {
    const map = this.map as (MapLike & { getBounds?: () => { getNorth(): number; getSouth(): number; getEast(): number; getWest(): number }; getZoom?: () => number }) | null;
    const settings = this.settings;
    const provider = this.activeProvider();
    if (!map || !settings || !provider?.dynamicAttribution || !map.getBounds || !map.getZoom) return;
    const bounds = map.getBounds();
    const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
    const north = clamp(bounds.getNorth(), 89.9);
    const south = clamp(bounds.getSouth(), 89.9);
    const east = clamp(bounds.getEast(), 179.9);
    const west = clamp(bounds.getWest(), 179.9);
    const zoom = Math.max(0, Math.min(provider.maxZoom, Math.round(map.getZoom())));
    const key = [zoom, north, south, east, west].map((value) => value.toFixed(3)).join(',');
    if (key === this.lastViewportKey) return;
    const token = ++this.viewportToken;
    try {
      const params = new URLSearchParams({ zoom: String(zoom), north: String(north), south: String(south), east: String(east), west: String(west) });
      const response = await fetch(`${settings.proxyBaseUrl}/sat/google/viewport?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { copyright?: string };
      if (token !== this.viewportToken || this.activeProvider()?.id !== provider.id) return;
      this.lastViewportKey = key;
      const copyright = payload.copyright ? ` · ${escapeHtml(payload.copyright)}` : '';
      this.attribution.set('satellite', `${escapeHtml(provider.attribution)}${copyright}`);
    } catch (error) {
      console.warn(`${TAG} Could not load the Google attribution for this view`, error);
    }
  }

  private remove(): void {
    const map = this.map;
    this.sourceKey = null;
    if (!map) return;
    try {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    } catch {
      // ignore
    }
  }

  private order(): string[] {
    try {
      return this.map?.getLayersOrder?.() ?? this.map?.getStyle().layers?.map((layer) => layer.id) ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Where the imagery goes in the layer stack.
   *
   * When the base map is hidden, the imagery sits ABOVE every ground layer (water, parks,
   * roads, airports). Then it covers them even if the game switches one back on — this is
   * what stops the water flickering through the imagery. It always stays below the
   * player's tracks/stations and below the railway overlay.
   *
   * When the base map is kept, the imagery sits BELOW it so the game's map draws on top.
   */
  private resolveBeforeId(aboveBaseMap: boolean): string | undefined {
    const order = this.order().filter((id) => id !== LAYER_ID);
    const ceilingCandidates = [
      ...FALLBACK_ANCHORS.map((id) => order.indexOf(id)),
      order.findIndex((id) => id.startsWith(`${MOD_ID}:`)),
    ].filter((index) => index >= 0);
    const ceiling = ceilingCandidates.length ? Math.min(...ceilingCandidates) : order.length;

    if (aboveBaseMap) {
      const groundIndexes = GROUND_LAYERS.map((id) => order.indexOf(id)).filter((index) => index >= 0 && index < ceiling);
      if (groundIndexes.length) {
        const target = Math.max(...groundIndexes) + 1;
        return target < order.length ? order[Math.min(target, ceiling)] : undefined;
      }
    } else {
      const baseIndexes = GAME_BASE_MAP_LAYERS.map((id) => order.indexOf(id)).filter((index) => index >= 0);
      if (baseIndexes.length) return order[Math.min(Math.min(...baseIndexes), ceiling)];
    }
    return ceiling < order.length ? order[ceiling] : undefined;
  }

  private keepInPlace(beforeId: string | undefined): void {
    const order = this.order();
    const index = order.indexOf(LAYER_ID);
    if (index < 0) return;
    const expected = beforeId ? order.indexOf(beforeId) - 1 : order.length - 1;
    if (index === expected) return;
    try {
      this.map?.moveLayer(LAYER_ID, beforeId);
    } catch {
      // ignore
    }
  }

  private hideBaseMap(): void {
    const map = this.map;
    if (!map) return;
    for (const id of GAME_BASE_MAP_LAYERS) {
      if (this.gameControlled.has(id) || !map.getLayer(id)) continue;
      try {
        const visibility = map.getLayoutProperty?.(id, 'visibility');
        if (visibility === 'none') {
          // Already hidden (by us or by the game) - nothing to do.
          continue;
        }
        if (this.hiddenGameLayers.has(id) && this.noteReshow(id)) continue;
        map.setLayoutProperty?.(id, 'visibility', 'none');
        this.hiddenGameLayers.add(id);
      } catch {
        // ignore
      }
    }
  }

  /** Records that the game turned a hidden layer back on; returns true once we should give up on it. */
  private noteReshow(id: string): boolean {
    const now = Date.now();
    const times = (this.reshowTimes.get(id) ?? []).filter((time) => now - time < FIGHT_WINDOW_MS);
    times.push(now);
    this.reshowTimes.set(id, times);
    if (times.length < FIGHT_LIMIT) return false;
    this.gameControlled.add(id);
    this.hiddenGameLayers.delete(id);
    console.info(`${TAG} The game keeps showing "${id}"; leaving it visible (the imagery is stacked above it instead).`);
    return true;
  }

  private restoreBaseMap(): void {
    const map = this.map;
    if (!map) {
      this.hiddenGameLayers.clear();
      return;
    }
    for (const id of this.hiddenGameLayers) {
      try {
        if (map.getLayer(id)) map.setLayoutProperty?.(id, 'visibility', 'visible');
      } catch {
        // ignore
      }
    }
    this.hiddenGameLayers.clear();
    this.gameControlled.clear();
    this.reshowTimes.clear();
  }
}
