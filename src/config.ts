import manifest from '../manifest.json';

export const MOD_ID = manifest.id;
export const MOD_NAME = manifest.name;
export const MOD_VERSION = manifest.version;
export const TAG = '[Open Overlay]';

export const DEFAULT_PROXY_BASE_URL = 'http://127.0.0.1:8788';

// ---------------------------------------------------------------------------
// OpenRailwayMap style "global state" options (mirrors openrailwaymap.app).
// ---------------------------------------------------------------------------

export const TRACK_MODES = [
  { value: 'usage', label: 'Usage (infrastructure)' },
  { value: 'speed', label: 'Maximum speed' },
  { value: 'train_protection', label: 'Train protection' },
  { value: 'voltage_frequency', label: 'Electrification (voltage / frequency)' },
  { value: 'maximum_current', label: 'Electrification (maximum current)' },
  { value: 'power', label: 'Electrification (power)' },
  { value: 'gauge', label: 'Track gauge' },
  { value: 'loading_gauge', label: 'Loading gauge' },
  { value: 'track_class', label: 'Track class' },
  { value: 'axle_load', label: 'Axle load' },
  { value: 'metre_load', label: 'Metre load' },
  { value: 'operator', label: 'Operator' },
  { value: 'routes', label: 'Routes' },
  { value: 'passenger_lines', label: 'Passenger lines' },
  { value: 'radio', label: 'Train radio' },
] as const;

export const STATION_MODES = [
  { value: 'station', label: 'Stations' },
  { value: 'operator', label: 'Stations by operator' },
  { value: 'none', label: 'Hidden' },
] as const;

export const PLAIN_MODES = [
  { value: 'plain', label: 'Shown' },
  { value: 'none', label: 'Hidden' },
] as const;

export const OPERATOR_MODES = [
  { value: 'plain', label: 'Shown' },
  { value: 'operator', label: 'By operator' },
  { value: 'none', label: 'Hidden' },
] as const;

export const SIGNAL_TYPES = [
  { value: 'main', label: 'Main' },
  { value: 'distant', label: 'Distant' },
  { value: 'speed', label: 'Speed' },
  { value: 'train_protection', label: 'Train protection' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'station', label: 'Station' },
  { value: 'radio', label: 'Radio' },
  { value: 'shunting', label: 'Shunting' },
  { value: 'other', label: 'Other' },
] as const;

export const POI_TYPES = [
  { value: 'facility', label: 'Facilities' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'level_crossing', label: 'Level crossings' },
  { value: 'train_protection', label: 'Train protection' },
  { value: 'vacancy_detection', label: 'Vacancy detection' },
  { value: 'electrical_equipment', label: 'Electrical' },
  { value: 'radio', label: 'Radio' },
  { value: 'operator', label: 'Operators' },
] as const;

export type TrackMode = typeof TRACK_MODES[number]['value'];
export type StationMode = typeof STATION_MODES[number]['value'];
export type PlainMode = typeof PLAIN_MODES[number]['value'];
export type OperatorMode = typeof OPERATOR_MODES[number]['value'];
export type SignalType = typeof SIGNAL_TYPES[number]['value'];
export type PoiType = typeof POI_TYPES[number]['value'];
export type ThemeMode = 'auto' | 'light' | 'dark';
export type StationLabelMode = 'label' | 'name';
export type LanguageMode = 'auto' | 'off' | 'custom';

/** The subset of OpenRailwayMap's style state that the player controls. */
export type OrmMapState = {
  tracks: TrackMode;
  stations: StationMode;
  platforms: PlainMode;
  switches: PlainMode;
  substations: PlainMode;
  boxes: OperatorMode;
  catenaries: OperatorMode;
  signals: SignalType[];
  pois: PoiType[];
  showConstructionInfrastructure: boolean;
  showProposedInfrastructure: boolean;
  showAbandonedInfrastructure: boolean;
  showRazedInfrastructure: boolean;
  stationLowZoomLabel: StationLabelMode;
};

export const PRESETS: Array<{ id: string; label: string; state: Partial<OrmMapState> }> = [
  {
    id: 'standard',
    label: 'Infrastructure',
    state: {
      tracks: 'usage', stations: 'station', platforms: 'plain', switches: 'plain',
      substations: 'none', boxes: 'none', catenaries: 'none', signals: [],
      pois: ['radio', 'facility', 'equipment', 'level_crossing', 'train_protection'],
    },
  },
  {
    id: 'speed',
    label: 'Speed',
    state: {
      tracks: 'speed', stations: 'none', platforms: 'none', switches: 'none',
      substations: 'none', boxes: 'none', catenaries: 'none', signals: ['speed'], pois: [],
    },
  },
  {
    id: 'signals',
    label: 'Train protection',
    state: {
      tracks: 'train_protection', stations: 'none', platforms: 'none', switches: 'none',
      substations: 'none', boxes: 'plain', catenaries: 'none',
      signals: ['main', 'distant', 'train_protection', 'station', 'radio', 'shunting', 'other'],
      pois: ['vacancy_detection', 'train_protection'],
    },
  },
  {
    id: 'electrification',
    label: 'Electrification',
    state: {
      tracks: 'voltage_frequency', stations: 'none', platforms: 'none', switches: 'none',
      substations: 'plain', boxes: 'none', catenaries: 'plain', signals: ['electricity'],
      pois: ['electrical_equipment'],
    },
  },
  {
    id: 'track',
    label: 'Track',
    state: {
      tracks: 'gauge', stations: 'none', platforms: 'none', switches: 'none',
      substations: 'none', boxes: 'none', catenaries: 'none', signals: [], pois: [],
    },
  },
  {
    id: 'operator',
    label: 'Operator',
    state: {
      tracks: 'operator', stations: 'operator', platforms: 'none', switches: 'none',
      substations: 'none', boxes: 'operator', catenaries: 'none', signals: [], pois: ['operator'],
    },
  },
  {
    id: 'route',
    label: 'Routes',
    state: {
      tracks: 'routes', stations: 'station', platforms: 'none', switches: 'none',
      substations: 'none', boxes: 'none', catenaries: 'none', signals: [], pois: [],
    },
  },
  {
    id: 'everything',
    label: 'Everything',
    state: {
      tracks: 'usage', stations: 'station', platforms: 'plain', switches: 'plain',
      substations: 'plain', boxes: 'plain', catenaries: 'plain',
      signals: SIGNAL_TYPES.map((signal) => signal.value),
      pois: POI_TYPES.map((poi) => poi.value),
    },
  },
];

export type OverlaySettings = {
  proxyBaseUrl: string;
  enabled: boolean;
  opacity: number;
  aboveTracks: boolean;
  theme: ThemeMode;
  /**
   * Station name language, like openrailwaymap.app's "Localization" setting:
   * auto = your system language (shows e.g. the English name above the native one),
   * off = native names only, custom = the OSM code(s) in `language`.
   */
  languageMode: LanguageMode;
  /** OSM language code(s) used when languageMode is "custom", e.g. "en" or "ja-Latn,en". */
  language: string;
  inspectOnClick: boolean;
  mapState: OrmMapState;
  satellite: SatelliteSettings;
};

export type SatelliteSettings = {
  enabled: boolean;
  provider: string;
  opacity: number;
  /** Hide the game's own base map (buildings, water, parks, roads, airports, area labels) under the imagery. */
  hideBaseMap: boolean;
};

/** Providers that were removed; saved choices fall back to the default. */
const RETIRED_SATELLITE_PROVIDERS = new Set(['esri', 'eox-s2', 'maptiler']);

export const DEFAULT_SATELLITE: SatelliteSettings = {
  enabled: false,
  provider: 'google-sat',
  opacity: 1,
  hideBaseMap: true,
};

/** Game base-map layers (ids from the game style, as used by Orbital Surveyor). */
export const GAME_BASE_MAP_LAYERS = [
  'buildings-3d',
  'water', 'ocean-depth-labels', 'general-tiles',
  'parks-large', 'parks-small', 'parks-modded', 'commercial',
  'road-labels', 'intersections-layer', 'road-lines', 'road-bridge-casing', 'road-bridge-fill',
  'road-lines-minor', 'road-lines-medium', 'road-lines-major', 'road-lines-highway',
  'road-bridge-casing-minor', 'road-bridge-fill-minor', 'road-bridge-casing-major',
  'road-bridge-fill-major', 'road-bridge-casing-highway', 'road-bridge-fill-highway',
  'airports', 'runways-taxiways', 'airports-modded',
  'neighborhood-labels', 'suburb-labels', 'city-labels',
];

export const DEFAULT_MAP_STATE: OrmMapState = {
  ...(PRESETS[0].state as OrmMapState),
  showConstructionInfrastructure: true,
  showProposedInfrastructure: true,
  showAbandonedInfrastructure: false,
  showRazedInfrastructure: false,
  stationLowZoomLabel: 'label',
};

export const DEFAULT_SETTINGS: OverlaySettings = {
  proxyBaseUrl: DEFAULT_PROXY_BASE_URL,
  enabled: false,
  opacity: 1,
  aboveTracks: false,
  theme: 'auto',
  languageMode: 'auto',
  language: '',
  inspectOnClick: false,
  mapState: { ...DEFAULT_MAP_STATE },
  satellite: { ...DEFAULT_SATELLITE },
};

// ---------------------------------------------------------------------------
// Normalization (settings come from storage and may be stale or hand-edited)
// ---------------------------------------------------------------------------

export function normalizeProxyBaseUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_PROXY_BASE_URL;
  const trimmed = value.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s]+$/.test(trimmed) ? trimmed : DEFAULT_PROXY_BASE_URL;
}

export function normalizeLanguage(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\s+/g, '');
  return /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*(?:,[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*)*$/.test(trimmed)
    ? trimmed
    : '';
}

function pickOne<T extends string>(value: unknown, options: readonly { value: T }[], fallback: T): T {
  return options.some((option) => option.value === value) ? value as T : fallback;
}

function pickMany<T extends string>(value: unknown, options: readonly { value: T }[], fallback: T[]): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set(options.map((option) => option.value));
  return [...new Set(value.filter((item): item is T => allowed.has(item as T)))];
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeMapState(value: unknown): OrmMapState {
  const input = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof OrmMapState, unknown>>;
  const d = DEFAULT_MAP_STATE;
  return {
    tracks: pickOne(input.tracks, TRACK_MODES, d.tracks),
    stations: pickOne(input.stations, STATION_MODES, d.stations),
    platforms: pickOne(input.platforms, PLAIN_MODES, d.platforms),
    switches: pickOne(input.switches, PLAIN_MODES, d.switches),
    substations: pickOne(input.substations, PLAIN_MODES, d.substations),
    boxes: pickOne(input.boxes, OPERATOR_MODES, d.boxes),
    catenaries: pickOne(input.catenaries, OPERATOR_MODES, d.catenaries),
    signals: pickMany(input.signals, SIGNAL_TYPES, d.signals),
    pois: pickMany(input.pois, POI_TYPES, d.pois),
    showConstructionInfrastructure: bool(input.showConstructionInfrastructure, d.showConstructionInfrastructure),
    showProposedInfrastructure: bool(input.showProposedInfrastructure, d.showProposedInfrastructure),
    showAbandonedInfrastructure: bool(input.showAbandonedInfrastructure, d.showAbandonedInfrastructure),
    showRazedInfrastructure: bool(input.showRazedInfrastructure, d.showRazedInfrastructure),
    stationLowZoomLabel: input.stationLowZoomLabel === 'name' ? 'name' : 'label',
  };
}

export function normalizeSettings(value: unknown): OverlaySettings {
  const input = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof OverlaySettings, unknown>>;
  const opacity = typeof input.opacity === 'number' && Number.isFinite(input.opacity)
    ? Math.min(1, Math.max(0, input.opacity))
    : DEFAULT_SETTINGS.opacity;
  return {
    proxyBaseUrl: normalizeProxyBaseUrl(input.proxyBaseUrl ?? DEFAULT_SETTINGS.proxyBaseUrl),
    enabled: bool(input.enabled, DEFAULT_SETTINGS.enabled),
    opacity,
    aboveTracks: bool(input.aboveTracks, DEFAULT_SETTINGS.aboveTracks),
    theme: input.theme === 'light' || input.theme === 'dark' ? input.theme : 'auto',
    languageMode: input.languageMode === 'auto' || input.languageMode === 'off' || input.languageMode === 'custom'
      ? input.languageMode
      // Older saved settings: a typed language meant "custom", otherwise follow the system like ORM.
      : (normalizeLanguage(input.language) ? 'custom' : 'auto'),
    language: normalizeLanguage(input.language),
    inspectOnClick: bool(input.inspectOnClick, DEFAULT_SETTINGS.inspectOnClick),
    mapState: normalizeMapState(input.mapState),
    satellite: normalizeSatellite(input.satellite),
  };
}

export function normalizeSatellite(value: unknown): SatelliteSettings {
  const input = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof SatelliteSettings, unknown>>;
  return {
    enabled: bool(input.enabled, DEFAULT_SATELLITE.enabled),
    provider: typeof input.provider === 'string' && /^[a-z0-9-]{1,40}$/.test(input.provider) && !RETIRED_SATELLITE_PROVIDERS.has(input.provider)
      ? input.provider
      : DEFAULT_SATELLITE.provider,
    opacity: typeof input.opacity === 'number' && Number.isFinite(input.opacity)
      ? Math.min(1, Math.max(0, input.opacity))
      : DEFAULT_SATELLITE.opacity,
    hideBaseMap: bool(input.hideBaseMap, DEFAULT_SATELLITE.hideBaseMap),
  };
}

/** Which preset (if any) exactly matches the current map state. */
export function matchPreset(state: OrmMapState): string | null {
  const keys: Array<keyof OrmMapState> = ['tracks', 'stations', 'platforms', 'switches', 'substations', 'boxes', 'catenaries', 'signals', 'pois'];
  for (const preset of PRESETS) {
    const same = keys.every((key) => {
      const a = preset.state[key];
      const b = state[key];
      if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item) => (b as string[]).includes(item as string));
      }
      return a === b;
    });
    if (same) return preset.id;
  }
  return null;
}

/** The system language as an OSM language code (what openrailwaymap.app's "Automatic" uses). */
export function systemLanguage(): string {
  try {
    const tag = (globalThis.navigator?.languages?.[0] ?? globalThis.navigator?.language ?? '').trim();
    if (!tag) return 'en';
    return new Intl.Locale(tag).language || 'en';
  } catch {
    return 'en';
  }
}

/** The ?lang= value sent to OpenRailwayMap, or '' for native names only. */
export function effectiveLanguage(settings: Pick<OverlaySettings, 'languageMode' | 'language'>): string {
  if (settings.languageMode === 'off') return '';
  if (settings.languageMode === 'custom') return settings.language;
  return systemLanguage();
}
