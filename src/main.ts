import { MOD_ID, MOD_NAME, MOD_VERSION, TAG, type OverlaySettings } from './config';
import { OrmLayerManager, type MapLike } from './OrmLayerManager';
import { OverlayStore, type ProxyHealth } from './store';
import { SatelliteLayerManager } from './SatelliteLayerManager';
import { MapAttribution } from './attribution';
import { OverlayPanel } from './ui/OverlayPanel';
import { injectOverlayStyles } from './ui/styles';

const api = window.SubwayBuilderAPI;
const React = api?.utils.React;
const REGISTRATION_KEY = '__openOverlayRegistered';

type RuntimeWindow = Window & typeof globalThis & { [REGISTRATION_KEY]?: { registeredAt: number } };

class OpenOverlayMod {
  private store: OverlayStore | null = null;
  private layers: OrmLayerManager | null = null;
  private satellite: SatelliteLayerManager | null = null;
  private attribution: MapAttribution | null = null;
  private lastHealth: ProxyHealth | null = null;
  private unsubscribe: (() => void) | null = null;
  private initializing: Promise<void> | null = null;
  private lastSettings: OverlaySettings | null = null;
  private lastProxyReady: boolean | null = null;
  private notifiedOutage = false;

  async onMapReady(map: unknown): Promise<void> {
    if (!this.store) {
      this.initializing ??= this.initialize();
      await this.initializing;
    }
    if (map && this.layers) {
      this.satellite?.setMap(map as MapLike);
      this.satellite?.setSettings(this.store!.getSettings());
      this.layers.setMap(map as MapLike);
      this.layers.setSettings(this.store!.getSettings());
    }
  }

  private async initialize(): Promise<void> {
    console.log(`${TAG} ${MOD_NAME} v${MOD_VERSION} | API v${api.version}`);
    injectOverlayStyles();

    const store = new OverlayStore(api);
    const attribution = new MapAttribution();
    const layers = new OrmLayerManager(store, attribution);
    this.attribution = attribution;
    this.satellite = new SatelliteLayerManager(store, attribution);
    this.store = store;
    this.layers = layers;

    this.unsubscribe = store.subscribe(() => this.onStoreChange());
    await store.initialize();

    // Registered per game session, like other floating-panel mods (the game clears panels on exit).
    api.ui.addFloatingPanel({
      id: `${MOD_ID}-panel`,
      title: 'Open Overlay',
      icon: 'TrainTrack',
      defaultWidth: 380,
      defaultHeight: 620,
      render: () => React.createElement(OverlayPanel, { store: this.store!, layers: this.layers! }),
    });
  }

  /** Only push to the map when something that affects it changed (not on inspector updates). */
  private onStoreChange(): void {
    const store = this.store;
    const layers = this.layers;
    if (!store || !layers) return;
    const settings = store.getSettings();
    const proxyReady = store.isProxyReady();
    const health = store.getSnapshot().proxyHealth;
    // Health refreshes every 15 s; re-syncing then lets the overlay recover (e.g. retry icons)
    // and picks up the proxy's list of satellite providers.
    if (settings !== this.lastSettings || proxyReady !== this.lastProxyReady || health !== this.lastHealth) {
      this.lastSettings = settings;
      this.lastProxyReady = proxyReady;
      this.lastHealth = health;
      this.satellite?.setSettings(settings);
      layers.setSettings(settings);
    }

    if ((settings.enabled || settings.satellite.enabled) && !proxyReady && store.getSnapshot().proxyError) {
      if (!this.notifiedOutage) {
        this.notifiedOutage = true;
        api.ui.showNotification('Open Overlay proxy is not running. Start it from the mod folder to see railway data and imagery.', 'warning');
      }
    } else if (proxyReady) {
      this.notifiedOutage = false;
    }
  }

  onGameEnd(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.layers?.destroy();
    this.satellite?.destroy();
    this.attribution?.destroy();
    this.store?.destroy();
    this.layers = null;
    this.satellite = null;
    this.attribution = null;
    this.lastHealth = null;
    this.store = null;
    this.initializing = null;
    this.lastSettings = null;
    this.lastProxyReady = null;
    this.notifiedOutage = false;
  }
}

const runtime = window as RuntimeWindow;

if (!api) {
  console.error(`${TAG} SubwayBuilderAPI not found`);
} else if (runtime[REGISTRATION_KEY] && Date.now() - runtime[REGISTRATION_KEY]!.registeredAt < 2000) {
  console.warn(`${TAG} Duplicate load detected; skipping second registration.`);
} else {
  runtime[REGISTRATION_KEY] = { registeredAt: Date.now() };
  const mod = new OpenOverlayMod();
  api.hooks.onMapReady((map) => {
    void mod.onMapReady(map).catch((error) => {
      console.error(`${TAG} Failed to initialize`, error);
      api.ui.showNotification(`${MOD_NAME} failed to load. Check the console for details.`, 'error');
    });
  });
  api.hooks.onGameEnd(() => mod.onGameEnd());
}
