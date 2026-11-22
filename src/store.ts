import {
  DEFAULT_SETTINGS,
  MOD_ID,
  normalizeSettings,
  type OverlaySettings,
} from './config';
import type { ModdingAPI } from './types/api';

export type ProxyHealth = {
  ok: boolean;
  ready?: boolean;
  status: string;
  service?: string;
  version?: string;
  upstream?: string;
  upstreamLastSuccessAt?: string | null;
  upstreamLastFailureAt?: string | null;
  upstreamLastFailure?: string | null;
  referer?: string;
  cache?: { entries: number; bytes: number; maxBytes: number };
  satelliteCache?: { entries: number; bytes: number; maxBytes: number };
  diskCache?: Record<string, DiskCacheStats>;
  diskCacheDir?: string;
  satelliteProviders?: SatelliteProvider[];
};

export type DiskCacheStats = {
  dir: string;
  bytes: number;
  files: number;
  maxBytes: number;
  ready: boolean;
  clearing: boolean;
  diskFull: boolean;
  enabled: boolean;
};

export type SatelliteProvider = {
  id: string;
  label: string;
  attribution: string;
  /** The provider's credit changes with the area on screen and must be fetched (Google Map Tiles API). */
  dynamicAttribution?: boolean;
  tileSize: number;
  maxZoom: number;
  configured: boolean;
  requires: string | null;
};

export type LayerStatus = {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  layerCount: number;
  failedLayers: number;
  globalStateMode: 'native' | 'baked' | null;
};

export type InspectedFeature = {
  layerId: string;
  originalLayerId: string;
  source: string;
  sourceLayer: string | null;
  id: string | number | null;
  properties: Record<string, unknown>;
};

export type FeatureDetails = {
  loading: boolean;
  error: string | null;
  properties: Record<string, unknown> | null;
};

export type ActiveRoute = { id: string; label: string; color: string | null } | null;

export type OverlaySnapshot = {
  settings: OverlaySettings;
  proxyHealth: ProxyHealth | null;
  proxyError: string | null;
  proxyReady: boolean;
  layerStatus: LayerStatus;
  inspected: InspectedFeature[];
  details: Record<string, FeatureDetails>;
  activeRoute: ActiveRoute;
};

type Listener = () => void;

const STORAGE_KEY = 'settings';
const LOCAL_STORAGE_KEY = `${MOD_ID}:${STORAGE_KEY}`;
const LEGACY_LOCAL_STORAGE_KEY = `openrailwaymap-overlay:${STORAGE_KEY}`;
const HEALTH_INTERVAL_MS = 15000;

export class OverlayStore {
  private settings: OverlaySettings = { ...DEFAULT_SETTINGS };
  private proxyHealth: ProxyHealth | null = null;
  private proxyError: string | null = null;
  private healthFailures = 0;
  private healthTimer: number | null = null;
  private healthPromise: Promise<void> | null = null;
  private listeners = new Set<Listener>();
  private layerStatus: LayerStatus = { phase: 'idle', message: 'Overlay off', layerCount: 0, failedLayers: 0, globalStateMode: null };
  private inspected: InspectedFeature[] = [];
  private details: Record<string, FeatureDetails> = {};
  private activeRoute: ActiveRoute = null;
  private snapshot: OverlaySnapshot | null = null;

  constructor(private readonly api: ModdingAPI) {}

  async initialize(): Promise<void> {
    this.settings = normalizeSettings(await this.loadSettings());
    this.emit();
    await this.refreshProxyHealth();
    this.healthTimer = window.setInterval(() => void this.refreshProxyHealth(), HEALTH_INTERVAL_MS);
  }

  destroy(): void {
    if (this.quickRetryTimer !== null) window.clearTimeout(this.quickRetryTimer);
    if (this.healthTimer !== null) window.clearInterval(this.healthTimer);
    this.healthTimer = null;
    this.listeners.clear();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): OverlaySnapshot {
    if (!this.snapshot) {
      this.snapshot = {
        settings: this.settings,
        proxyHealth: this.proxyHealth,
        proxyError: this.proxyError,
        proxyReady: this.isProxyReady(),
        layerStatus: this.layerStatus,
        inspected: this.inspected,
        details: this.details,
        activeRoute: this.activeRoute,
      };
    }
    return this.snapshot;
  }

  getSatelliteProviders(): SatelliteProvider[] {
    return this.proxyHealth?.satelliteProviders ?? [];
  }

  getSettings(): OverlaySettings {
    return this.settings;
  }

  isProxyReady(): boolean {
    return !this.proxyError && Boolean(this.proxyHealth?.ok && (this.proxyHealth.ready ?? true));
  }

  updateSettings(patch: Partial<OverlaySettings>): void {
    const previousProxy = this.settings.proxyBaseUrl;
    this.settings = normalizeSettings({
      ...this.settings,
      ...patch,
      mapState: { ...this.settings.mapState, ...(patch.mapState ?? {}) },
      satellite: { ...this.settings.satellite, ...(patch.satellite ?? {}) },
    });
    this.persist();
    this.emit();
    if (this.settings.proxyBaseUrl !== previousProxy) {
      this.proxyHealth = null;
      this.proxyError = null;
      this.healthFailures = 0;
      void this.refreshProxyHealth();
    }
  }

  setLayerStatus(status: Partial<LayerStatus>): void {
    this.layerStatus = { ...this.layerStatus, ...status };
    this.emit();
  }

  setInspected(features: InspectedFeature[]): void {
    this.inspected = features;
    this.details = {};
    this.emit();
  }

  setDetails(key: string, details: FeatureDetails): void {
    this.details = { ...this.details, [key]: details };
    this.emit();
  }

  setActiveRoute(route: ActiveRoute): void {
    this.activeRoute = route;
    this.emit();
  }

  /** Empties one of the proxy's disk caches ("openrailwaymap" or "google-keyless"). */
  async clearDiskCache(id: 'openrailwaymap' | 'google-keyless'): Promise<boolean> {
    try {
      const response = await fetch(`${this.settings.proxyBaseUrl}/cache/${id}`, { method: 'DELETE' });
      return response.ok;
    } catch {
      return false;
    } finally {
      window.setTimeout(() => void this.refreshProxyHealth(), 1000);
    }
  }

  /** Asks the proxy to open the cache folder in the file explorer. */
  async openCacheFolder(): Promise<boolean> {
    try {
      const response = await fetch(`${this.settings.proxyBaseUrl}/cache/open`, { method: 'POST' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async refreshProxyHealth(): Promise<void> {
    if (this.healthPromise) return this.healthPromise;
    this.healthPromise = this.fetchHealth().finally(() => {
      this.healthPromise = null;
    });
    return this.healthPromise;
  }

  private async fetchHealth(): Promise<void> {
    try {
      // Status port first (not shared with tile downloads), then the main port (older proxies).
      const { payload, ok, status } = await fetchHealthFrom([statusBaseUrl(this.settings.proxyBaseUrl), this.settings.proxyBaseUrl]);
      if (payload.service && payload.service !== 'open-overlay-proxy') {
        throw new Error('Another proxy is running on this port');
      }
      this.proxyHealth = payload;
      this.proxyError = ok ? null : `Proxy returned ${status}`;
      this.healthFailures = 0;
      this.scheduleQuickRetry(false);
    } catch (error) {
      this.healthFailures += 1;
      // A slow or missed answer is usually a busy moment, not a stopped proxy: only report the
      // proxy as down after 3 failed checks in a row (about 15 s), retrying every 5 s meanwhile.
      if (this.healthFailures >= 3) {
        this.proxyHealth = null;
        this.proxyError = error instanceof Error
          ? (error.name === 'AbortError' || error.name === 'TimeoutError' ? 'Proxy not responding' : error.message === 'Failed to fetch' ? 'Proxy not running' : error.message)
          : 'Proxy unavailable';
      }
      this.scheduleQuickRetry(true);
    } finally {
      this.emit();
    }
  }

  private quickRetryTimer: number | null = null;

  private scheduleQuickRetry(enabled: boolean): void {
    if (this.quickRetryTimer !== null) window.clearTimeout(this.quickRetryTimer);
    this.quickRetryTimer = null;
    if (enabled && this.healthFailures < 12) {
      this.quickRetryTimer = window.setTimeout(() => void this.refreshProxyHealth(), 5000);
    }
  }

  private async loadSettings(): Promise<unknown> {
    try {
      const local = window.localStorage.getItem(LOCAL_STORAGE_KEY) ??
        // Carry settings over from when this mod was called "OpenRailwayMap Overlay".
        window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
      if (local) return JSON.parse(local);
    } catch {
      // ignore
    }
    try {
      return await this.api.storage.get(STORAGE_KEY, DEFAULT_SETTINGS);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  private persist(): void {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
    void this.api.storage?.set?.(STORAGE_KEY, this.settings)?.catch?.(() => undefined);
  }

  private emit(): void {
    this.snapshot = null;
    for (const listener of this.listeners) listener();
  }
}

/** The proxy's status port (main port + 1), used for health checks and the heartbeat. */
export function statusBaseUrl(proxyBaseUrl: string): string {
  try {
    const url = new URL(proxyBaseUrl);
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    url.port = String(port + 1);
    return url.origin;
  } catch {
    return proxyBaseUrl;
  }
}

async function fetchHealthFrom(bases: string[]): Promise<{ payload: ProxyHealth; ok: boolean; status: number }> {
  let lastError: unknown = null;
  for (const base of bases) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${base}/health`, { signal: controller.signal, cache: 'no-store' });
      const payload = await response.json() as ProxyHealth;
      return { payload, ok: response.ok, status: response.status };
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error('Proxy unavailable');
}
