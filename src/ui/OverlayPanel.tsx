import { useEffect, useState } from 'react';
import {
  DEFAULT_PROXY_BASE_URL,
  OPERATOR_MODES,
  PLAIN_MODES,
  POI_TYPES,
  PRESETS,
  SIGNAL_TYPES,
  STATION_MODES,
  TRACK_MODES,
  matchPreset,
  normalizeLanguage,
  normalizeProxyBaseUrl,
  effectiveLanguage,
  systemLanguage,
  type OrmMapState,
  type OverlaySettings,
} from '../config';
import { featureKey, type OrmLayerManager } from '../OrmLayerManager';
import type { InspectedFeature, OverlaySnapshot, OverlayStore } from '../store';

const api = window.SubwayBuilderAPI;
type Component = (props: Record<string, unknown>) => unknown;
const components = (api.utils.components ?? {}) as Record<string, Component>;
const Button = components.Button;
const icons = (api.utils.icons ?? {}) as Record<string, Component>;
const ChevronDown = icons.ChevronDown;
const TrainIcon = icons.TrainFront ?? icons.Train ?? icons.Route;
const LayersIcon = icons.Layers;
const SignalIcon = icons.TrafficCone ?? icons.Signal ?? icons.Radio;
const PinIcon = icons.MapPin;
const SettingsIcon = icons.Settings ?? icons.SlidersHorizontal;
const SearchIcon = icons.Search;
const InfoIcon = icons.Info ?? icons.MousePointerClick;
const ServerIcon = icons.Server ?? icons.Plug ?? icons.Wifi;
const SatelliteIcon = icons.Satellite ?? icons.Globe ?? icons.Earth;
const README_URL = 'https://openrailwaymap.app';

type Props = { store: OverlayStore; layers: OrmLayerManager };

export function OverlayPanel({ store, layers }: Props) {
  const [snapshot, setSnapshot] = useState<OverlaySnapshot>(() => store.getSnapshot());
  const [open, setOpen] = useState<Record<string, boolean>>({ layers: true });
  const [proxyDraft, setProxyDraft] = useState(snapshot.settings.proxyBaseUrl);
  const [languageDraft, setLanguageDraft] = useState(snapshot.settings.language);

  useEffect(() => store.subscribe(() => setSnapshot(store.getSnapshot())), [store]);
  useEffect(() => setProxyDraft(snapshot.settings.proxyBaseUrl), [snapshot.settings.proxyBaseUrl]);
  useEffect(() => setLanguageDraft(snapshot.settings.language), [snapshot.settings.language]);

  const { settings } = snapshot;
  const state = settings.mapState;
  const update = (patch: Partial<OverlaySettings>) => store.updateSettings(patch);
  const updateState = (patch: Partial<OrmMapState>) => store.updateSettings({ mapState: { ...state, ...patch } });
  const toggleSection = (key: string) => setOpen((current) => ({ ...current, [key]: !current[key] }));
  const toggleInList = <T extends string>(list: T[], value: T): T[] => (
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  );
  const satellite = settings.satellite;
  const updateSatellite = (patch: Partial<OverlaySettings['satellite']>) => store.updateSettings({ satellite: { ...satellite, ...patch } });
  const satelliteProviders = store.getSatelliteProviders();
  const selectedProvider = satelliteProviders.find((provider) => provider.id === satellite.provider) ?? null;
  const satelliteOptions = satelliteProviders.length
    ? satelliteProviders.map((provider) => ({
      value: provider.id,
      label: provider.configured ? provider.label : `${provider.label} (needs ${provider.requires})`,
    }))
    : [{ value: satellite.provider, label: snapshot.proxyReady ? satellite.provider : 'Start the proxy to list imagery' }];
  const satelliteStatus = !satellite.enabled
    ? 'Imagery hidden'
    : !snapshot.proxyReady
      ? 'Waiting for proxy'
      : selectedProvider && !selectedProvider.configured
        ? `Needs ${selectedProvider.requires}`
        : `${selectedProvider?.label ?? satellite.provider} · ${Math.round(satellite.opacity * 100)}%`;
  const upstreamBlocked = /HTTP 403/.test(snapshot.proxyHealth?.upstreamLastFailure ?? '') &&
    /openrailwaymap/i.test(snapshot.proxyHealth?.upstreamLastFailure ?? '');
  const activePreset = matchPreset(state);
  const status = describeStatus(snapshot);

  return (
    <div className="orm-panel">
      {snapshot.proxyError ? (
        <div className="orm-warning" role="alert">
          <strong>Proxy not running</strong>
          <span>To have it start and stop with the game automatically, add the start-with-game launcher to Subway Builder's Steam launch options (see the README). Or double-click start-with-game in this mod's folder, then press Refresh.</span>
          <div className="orm-row" style={{ justifyContent: 'flex-start', gap: 12 }}>
            <button type="button" className="orm-link" onClick={() => openModsFolder()}>Open mods folder</button>
            <button
              type="button"
              className="orm-link"
              disabled={!snapshot.proxyReady}
              title={snapshot.proxyHealth?.diskCacheDir}
              onClick={() => {
                void store.openCacheFolder().then((ok) => {
                  if (!ok) api.ui.showNotification('Could not open the cache folder (is the proxy running?).', 'warning');
                });
              }}
            >
              Open cache folder
            </button>
            <button type="button" className="orm-link" onClick={() => void store.refreshProxyHealth()}>Refresh</button>
          </div>
        </div>
      ) : null}

      <section className="orm-section">
        <div className="orm-section-header">
          {TrainIcon ? <TrainIcon size={16} className="shrink-0 text-muted-foreground" /> : null}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="block text-sm font-semibold leading-tight">OpenRailwayMap</span>
            <span className="block truncate text-xs text-muted-foreground" title={status}>{status}</span>
          </span>
          <Toggle
            on={settings.enabled}
            disabled={!snapshot.proxyReady && !settings.enabled}
            onChange={(enabled) => update({ enabled })}
          />
        </div>
        <div className="orm-section-body">
          <div className="orm-label">Preset</div>
          <div className="orm-chips">
            {PRESETS.map((preset) => (
              <Chip
                key={preset.id}
                on={activePreset === preset.id}
                label={preset.label}
                onClick={() => updateState(preset.state)}
              />
            ))}
          </div>
          <Field label="Track colouring">
            <Select value={state.tracks} options={TRACK_MODES} onChange={(tracks) => updateState({ tracks: tracks as OrmMapState['tracks'] })} />
          </Field>
          <Range
            label="Opacity"
            value={settings.opacity}
            onChange={(opacity) => update({ opacity })}
          />
        </div>
      </section>

      <section className="orm-section">
        <div className="orm-section-header">
          <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, textAlign: 'left' }} onClick={() => toggleSection('satellite')}>
            {SatelliteIcon ? <SatelliteIcon size={15} className="shrink-0 text-muted-foreground" /> : null}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="block text-sm font-semibold leading-tight">Satellite</span>
              <span className="block truncate text-xs text-muted-foreground">{satelliteStatus}</span>
            </span>
            {ChevronDown ? <ChevronDown size={15} className={`shrink-0 text-muted-foreground transition-transform ${open.satellite ? 'rotate-180' : ''}`} /> : null}
          </button>
          <Toggle
            on={satellite.enabled}
            disabled={!snapshot.proxyReady && !satellite.enabled}
            onChange={(enabled) => updateSatellite({ enabled })}
          />
        </div>
        {open.satellite ? (
          <div className="orm-section-body">
            <Field label="Imagery">
              <Select
                value={satellite.provider}
                options={satelliteOptions}
                onChange={(provider) => updateSatellite({ provider })}
              />
            </Field>
            {selectedProvider && !selectedProvider.configured ? (
              <span className="orm-muted">Add {selectedProvider.requires} to the .env file next to proxy.js and restart the proxy to use this imagery.</span>
            ) : null}
            <Range label="Opacity" value={satellite.opacity} onChange={(opacity) => updateSatellite({ opacity })} />
            <div className="orm-row">
              <span className="orm-label">Hide game base map (buildings, water, parks, roads)</span>
              <Toggle on={satellite.hideBaseMap} onChange={(hideBaseMap) => updateSatellite({ hideBaseMap })} />
            </div>
          </div>
        ) : null}
      </section>

      <Section id="layers" title="Infrastructure" subtitle="Stations, platforms, switches, power" icon={LayersIcon} open={open} onToggle={toggleSection}>
        <Field label="Stations">
          <Select value={state.stations} options={STATION_MODES} onChange={(stations) => updateState({ stations: stations as OrmMapState['stations'] })} />
        </Field>
        <div className="orm-row"><span className="orm-label">Platforms &amp; platform edges</span><Toggle on={state.platforms === 'plain'} onChange={(on) => updateState({ platforms: on ? 'plain' : 'none' })} /></div>
        <div className="orm-row"><span className="orm-label">Switches</span><Toggle on={state.switches === 'plain'} onChange={(on) => updateState({ switches: on ? 'plain' : 'none' })} /></div>
        <div className="orm-row"><span className="orm-label">Substations</span><Toggle on={state.substations === 'plain'} onChange={(on) => updateState({ substations: on ? 'plain' : 'none' })} /></div>
        <Field label="Catenary masts & portals">
          <Select value={state.catenaries} options={OPERATOR_MODES} onChange={(catenaries) => updateState({ catenaries: catenaries as OrmMapState['catenaries'] })} />
        </Field>
        <Field label="Signal boxes">
          <Select value={state.boxes} options={OPERATOR_MODES} onChange={(boxes) => updateState({ boxes: boxes as OrmMapState['boxes'] })} />
        </Field>
        <div className="orm-label">Infrastructure lifecycle</div>
        <div className="orm-chips">
          <Chip label="Under construction" on={state.showConstructionInfrastructure} onClick={() => updateState({ showConstructionInfrastructure: !state.showConstructionInfrastructure })} />
          <Chip label="Proposed" on={state.showProposedInfrastructure} onClick={() => updateState({ showProposedInfrastructure: !state.showProposedInfrastructure })} />
          <Chip label="Abandoned" on={state.showAbandonedInfrastructure} onClick={() => updateState({ showAbandonedInfrastructure: !state.showAbandonedInfrastructure })} />
          <Chip label="Razed" on={state.showRazedInfrastructure} onClick={() => updateState({ showRazedInfrastructure: !state.showRazedInfrastructure })} />
        </div>
      </Section>

      <Section id="signals" title="Signals & points of interest" subtitle={`${state.signals.length} signal types, ${state.pois.length} POI types`} icon={SignalIcon} open={open} onToggle={toggleSection}>
        <div className="orm-row">
          <span className="orm-label">Signals</span>
          <span className="orm-row" style={{ gap: 10 }}>
            <button type="button" className="orm-link" onClick={() => updateState({ signals: SIGNAL_TYPES.map((s) => s.value) })}>All</button>
            <button type="button" className="orm-link" onClick={() => updateState({ signals: [] })}>None</button>
          </span>
        </div>
        <div className="orm-chips">
          {SIGNAL_TYPES.map((signal) => (
            <Chip key={signal.value} label={signal.label} on={state.signals.includes(signal.value)} onClick={() => updateState({ signals: toggleInList(state.signals, signal.value) })} />
          ))}
        </div>
        <div className="orm-row">
          <span className="orm-label">Points of interest</span>
          <span className="orm-row" style={{ gap: 10 }}>
            <button type="button" className="orm-link" onClick={() => updateState({ pois: POI_TYPES.map((p) => p.value) })}>All</button>
            <button type="button" className="orm-link" onClick={() => updateState({ pois: [] })}>None</button>
          </span>
        </div>
        <div className="orm-chips">
          {POI_TYPES.map((poi) => (
            <Chip key={poi.value} label={poi.label} on={state.pois.includes(poi.value)} onClick={() => updateState({ pois: toggleInList(state.pois, poi.value) })} />
          ))}
        </div>
        <span className="orm-muted">Signals appear from zoom 13 and need a close zoom to read.</span>
      </Section>

      <Section id="inspect" title="Inspect & routes" subtitle={settings.inspectOnClick ? 'Click the map to inspect railway features' : 'Inspection off'} icon={InfoIcon} open={open} onToggle={toggleSection}>
        <div className="orm-row">
          <span className="orm-label">Inspect features on click</span>
          <Toggle on={settings.inspectOnClick} onChange={(inspectOnClick) => update({ inspectOnClick })} />
        </div>
        {snapshot.activeRoute ? (
          <div className="orm-row">
            <span className="orm-chip" data-on="true">
              <span className="orm-swatch" style={{ background: snapshot.activeRoute.color || 'hsl(var(--primary))' }} />
              {snapshot.activeRoute.label || `Route ${snapshot.activeRoute.id}`}
            </span>
            <button type="button" className="orm-link" onClick={() => layers.showRoute(null)}>Hide route</button>
          </div>
        ) : null}
        {settings.inspectOnClick && !snapshot.inspected.length ? (
          <span className="orm-muted">Click a track, station, platform or signal. Tip: pick the Routes preset, click a line, open Details and choose a route to draw it.</span>
        ) : null}
        {snapshot.inspected.map((feature) => (
          <FeatureCard key={featureKey(feature)} feature={feature} snapshot={snapshot} layers={layers} />
        ))}
        {snapshot.inspected.length ? (
          <button type="button" className="orm-link" onClick={() => store.setInspected([])}>Clear</button>
        ) : null}
      </Section>

      <Section id="search" title="Find a station" subtitle="Search OpenRailwayMap by name or code" icon={SearchIcon ?? PinIcon} open={open} onToggle={toggleSection}>
        <StationSearch settings={settings} layers={layers} />
      </Section>

      <Section id="display" title="Display" subtitle={`${settings.aboveTracks ? 'Above' : 'Below'} your tracks · ${settings.theme} theme · names ${effectiveLanguage(settings) || 'native'}`} icon={SettingsIcon} open={open} onToggle={toggleSection}>
        <div className="orm-row"><span className="orm-label">Draw above your tracks</span><Toggle on={settings.aboveTracks} onChange={(aboveTracks) => update({ aboveTracks })} /></div>
        <Field label="Colour theme">
          <Select
            value={settings.theme}
            options={[{ value: 'auto', label: 'Match game map' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            onChange={(theme) => update({ theme: theme as OverlaySettings['theme'] })}
          />
        </Field>
        <Field label="Low-zoom station labels">
          <Select
            value={state.stationLowZoomLabel}
            options={[{ value: 'label', label: 'Station codes' }, { value: 'name', label: 'Station names' }]}
            onChange={(value) => updateState({ stationLowZoomLabel: value as OrmMapState['stationLowZoomLabel'] })}
          />
        </Field>
        <Field label="Station name language">
          <Select
            value={settings.languageMode}
            options={[
              { value: 'auto', label: `Automatic (system language: ${systemLanguage()})` },
              { value: 'off', label: 'Native names only' },
              { value: 'custom', label: 'Custom' },
            ]}
            onChange={(languageMode) => update({ languageMode: languageMode as OverlaySettings['languageMode'] })}
          />
        </Field>
        {settings.languageMode === 'custom' ? (
          <Field label="OSM language code(s), e.g. en or ja-Latn,en">
            <div className="orm-row">
              <input
                className="orm-input"
                value={languageDraft}
                placeholder="en"
                onChange={(event: { target: { value: string } }) => setLanguageDraft(event.target.value)}
              />
              <ActionButton onClick={() => update({ language: normalizeLanguage(languageDraft) })}>Apply</ActionButton>
            </div>
          </Field>
        ) : null}
        <span className="orm-muted">Station names show the chosen language with the native name underneath, like openrailwaymap.app. Line names come only in the native language.</span>
      </Section>

      <section className="orm-section">
        <div className="orm-section-header" style={{ cursor: 'default' }}>
          {ServerIcon ? <ServerIcon size={15} className="shrink-0 text-muted-foreground" /> : null}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="block text-sm font-semibold leading-tight">Proxy</span>
            <span className="block truncate text-xs text-muted-foreground">
              {snapshot.proxyReady ? `Connected · ${formatCache(snapshot)}` : (snapshot.proxyError ?? 'Checking…')}
            </span>
          </span>
          <span className={snapshot.proxyReady ? 'text-green-500' : 'text-amber-500'} style={{ fontSize: 11, fontWeight: 700 }}>
            {snapshot.proxyReady ? 'Ready' : 'Offline'}
          </span>
        </div>
        <div className="orm-section-body">
          <div className="orm-row">
            <input
              className="orm-input"
              value={proxyDraft}
              placeholder={DEFAULT_PROXY_BASE_URL}
              onChange={(event: { target: { value: string } }) => setProxyDraft(event.target.value)}
            />
            <ActionButton onClick={() => update({ proxyBaseUrl: normalizeProxyBaseUrl(proxyDraft) })}>Apply</ActionButton>
          </div>
          {upstreamBlocked ? (
            <div className="orm-warning">
              <strong>openrailwaymap.app is refusing requests</strong>
              <span>{snapshot.proxyHealth?.upstreamLastFailure}. Restart the proxy with the latest version of this mod, then press Reload overlay.</span>
            </div>
          ) : snapshot.proxyHealth?.upstreamLastFailure ? (
            <span className="orm-muted">Last upstream problem: {snapshot.proxyHealth.upstreamLastFailure}</span>
          ) : null}
          <DiskCacheRows snapshot={snapshot} store={store} />
          <div className="orm-row" style={{ justifyContent: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" className="orm-link" onClick={() => void store.refreshProxyHealth()}>Refresh status</button>
            <button type="button" className="orm-link" onClick={() => layers.reload()}>Reload overlay</button>
            <button type="button" className="orm-link" onClick={() => openModsFolder()}>Open mods folder</button>
            <button
              type="button"
              className="orm-link"
              disabled={!snapshot.proxyReady}
              title={snapshot.proxyHealth?.diskCacheDir}
              onClick={() => {
                void store.openCacheFolder().then((ok) => {
                  if (!ok) api.ui.showNotification('Could not open the cache folder (is the proxy running?).', 'warning');
                });
              }}
            >
              Open cache folder
            </button>
            <button type="button" className="orm-link" onClick={() => openExternal(README_URL)}>openrailwaymap.app</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ feature, snapshot, layers }: { feature: InspectedFeature; snapshot: OverlaySnapshot; layers: OrmLayerManager; key?: string }) {
  const details = snapshot.details[featureKey(feature)];
  const merged = { ...feature.properties, ...(details?.properties ?? {}) };
  const title = String(merged.name ?? merged.label ?? merged.ref ?? merged.railway ?? merged.feature ?? feature.originalLayerId);
  const routes = extractRoutes(merged);
  const entries = Object.entries(merged)
    .filter(([key, value]) => !HIDDEN_PROPS.has(key) && value !== null && value !== undefined && value !== '' &&
      (!Array.isArray(value) || value.length > 0))
    .slice(0, 40);

  return (
    <div className="orm-feature">
      <div className="orm-row">
        <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</strong>
        <span className="orm-muted" style={{ flexShrink: 0 }}>{feature.sourceLayer ?? feature.originalLayerId}</span>
      </div>
      <dl className="orm-props">
        {entries.map(([key, value]) => [
          <dt key={`${key}-k`}>{key.replace(/_/g, ' ')}</dt>,
          <dd key={`${key}-v`}>{formatValue(value)}</dd>,
        ])}
      </dl>
      {routes.length ? (
        <div className="orm-chips">
          {routes.map((route) => (
            <Chip
              key={route.id}
              label={route.label || `Route ${route.id}`}
              color={route.color}
              on={snapshot.activeRoute?.id === route.id}
              onClick={() => layers.showRoute(snapshot.activeRoute?.id === route.id ? null : route)}
            />
          ))}
        </div>
      ) : null}
      <div className="orm-row" style={{ justifyContent: 'flex-start', gap: 12 }}>
        {!details && feature.id !== null && feature.sourceLayer ? (
          <button type="button" className="orm-link" onClick={() => void layers.loadFeatureDetails(feature)}>Details</button>
        ) : null}
        {details?.loading ? <span className="orm-muted">Loading…</span> : null}
        {details?.error ? <span className="orm-muted">{details.error}</span> : null}
        {typeof merged.osm_id !== 'undefined' && merged.osm_id !== null ? (
          <button type="button" className="orm-link" onClick={() => openExternal(osmUrl(merged))}>Open in OSM</button>
        ) : null}
      </div>
    </div>
  );
}

function StationSearch({ settings, layers }: { settings: OverlaySettings; layers: OrmLayerManager }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ name: string; detail: string; lon: number; lat: number }>>([]);
  const [message, setMessage] = useState<string | null>(null);

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setMessage('Searching…');
    try {
      const params = new URLSearchParams({ q, limit: '15' });
      const language = effectiveLanguage(settings);
      if (language) params.set('lang', language);
      const response = await fetch(`${settings.proxyBaseUrl}/orm/api/facility?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json() as Array<Record<string, unknown>>;
      // OpenRailwayMap's facility API returns the longitude in "latitude" and vice versa
      // (its own web app reads them this way too).
      const parsed = rows
        .map((row) => ({
          name: String(row.name ?? row.label ?? 'Unnamed'),
          detail: [row.railway, row.railway_ref, row.operator].filter(Boolean).map(String).join(' · '),
          lon: Number(row.latitude),
          lat: Number(row.longitude),
        }))
        .filter((row) => Number.isFinite(row.lon) && Number.isFinite(row.lat));
      setResults(parsed);
      setMessage(parsed.length ? null : 'No matches');
    } catch (error) {
      setResults([]);
      setMessage(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="orm-row">
        <input
          className="orm-input"
          value={query}
          placeholder="e.g. Shinjuku or Jurong East"
          onChange={(event: { target: { value: string } }) => setQuery(event.target.value)}
          onKeyDown={(event: { key: string }) => { if (event.key === 'Enter') void search(); }}
        />
        <ActionButton onClick={() => void search()}>Search</ActionButton>
      </div>
      {message ? <span className="orm-muted">{message}</span> : null}
      {results.map((result, index) => (
        <button key={`${result.name}-${index}`} type="button" className="orm-result" onClick={() => layers.flyTo(result.lon, result.lat, 16)}>
          <div style={{ fontWeight: 600 }}>{result.name}</div>
          {result.detail ? <div className="orm-muted">{result.detail}</div> : null}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Section({ id, title, subtitle, icon: Icon, open, onToggle, children }: {
  id: string; title: string; subtitle: string; icon?: Component;
  open: Record<string, boolean>; onToggle: (id: string) => void; children?: unknown;
}) {
  const isOpen = Boolean(open[id]);
  return (
    <section className="orm-section">
      <button type="button" className="orm-section-header" style={{ textAlign: 'left' }} onClick={() => onToggle(id)}>
        {Icon ? <Icon size={15} className="shrink-0 text-muted-foreground" /> : null}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="block text-sm font-semibold leading-tight">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        {ChevronDown
          ? <ChevronDown size={15} className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          : <span className="orm-muted">{isOpen ? 'Hide' : 'Show'}</span>}
      </button>
      {isOpen ? <div className="orm-section-body">{children}</div> : null}
    </section>
  );
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} className="orm-toggle" data-on={on ? 'true' : 'false'} onClick={() => onChange(!on)}>
      <span className="orm-toggle-thumb" />
    </button>
  );
}

function Chip({ label, on, color, onClick }: { label: string; on: boolean; color?: string | null; onClick: () => void; key?: string }) {
  return (
    <button type="button" className="orm-chip" data-on={on ? 'true' : 'false'} onClick={onClick}>
      {color ? <span className="orm-swatch" style={{ background: color }} /> : null}
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children?: unknown }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="orm-label">{label}</span>
      {children}
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <select className="orm-select" value={value} onChange={(event: { target: { value: string } }) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function Range({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const percent = Math.round(value * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="orm-row"><span className="orm-label">{label}</span><span className="orm-muted">{percent}%</span></div>
      <input
        className="orm-range"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${percent}%, hsl(var(--border)) ${percent}%)` }}
        onChange={(event: { target: { value: string } }) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children?: unknown }) {
  if (Button) return <Button size="sm" onClick={onClick}>{children}</Button>;
  return <button type="button" className="orm-chip" onClick={onClick}>{children}</button>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HIDDEN_PROPS = new Set(['id', 'line_routes', 'way_length', 'rank', 'azimuth', 'direction_both']);

function describeStatus(snapshot: OverlaySnapshot): string {
  if (!snapshot.settings.enabled) return snapshot.proxyReady ? 'Off · proxy connected' : 'Off · proxy not connected';
  if (!snapshot.proxyReady) return 'Waiting for proxy';
  return snapshot.layerStatus.message;
}

const DISK_CACHE_LABELS = [
  { id: 'openrailwaymap', label: 'Railway data' },
  { id: 'google-keyless', label: 'Google imagery (keyless)' },
] as const;

function DiskCacheRows({ snapshot, store }: { snapshot: OverlaySnapshot; store: OverlayStore }) {
  const disk = snapshot.proxyHealth?.diskCache;
  if (!disk) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="orm-label">Saved on disk</span>
      {snapshot.proxyHealth?.diskCacheDir ? (
        <span className="orm-muted" style={{ wordBreak: 'break-all' }}>{snapshot.proxyHealth.diskCacheDir}</span>
      ) : null}
      {DISK_CACHE_LABELS.map(({ id, label }) => {
        const stats = disk[id];
        if (!stats?.enabled) return null;
        const status = stats.clearing
          ? 'clearing…'
          : !stats.ready
            ? 'counting…'
            : `${formatBytes(stats.bytes)} of ${formatBytes(stats.maxBytes)}${stats.diskFull ? ' · paused, drive nearly full' : ''}`;
        return (
          <div key={id} className="orm-row">
            <span className="orm-muted">{label}: {status}</span>
            <button
              type="button"
              className="orm-link"
              disabled={stats.clearing}
              onClick={() => {
                if (window.confirm(`Delete all saved ${label.toLowerCase()} (${formatBytes(stats.bytes)})? It will be downloaded again as you look around.`)) {
                  void store.clearDiskCache(id);
                }
              }}
            >
              Clear
            </button>
          </div>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatCache(snapshot: OverlaySnapshot): string {
  const cache = snapshot.proxyHealth?.cache;
  if (!cache) return 'ready';
  return `${(cache.bytes / 1048576).toFixed(1)} MB cached`;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

function extractRoutes(properties: Record<string, unknown>): Array<{ id: string; label: string; color: string | null }> {
  const raw = properties.line_routes;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? safeParse(raw) : [];
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: String(item.route_id ?? ''),
      label: String(item.label ?? ''),
      color: typeof item.color === 'string' && item.color ? item.color : null,
    }))
    .filter((route) => /^\d+$/.test(route.id));
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function osmUrl(properties: Record<string, unknown>): string {
  const type = String(properties.osm_type ?? 'way').toLowerCase();
  const kind = type.startsWith('n') ? 'node' : type.startsWith('r') ? 'relation' : 'way';
  return `https://www.openstreetmap.org/${kind}/${properties.osm_id}`;
}

function openExternal(url: string): void {
  const electron = (window as unknown as { electron?: { openExternalUrl?: (url: string) => Promise<void> } }).electron;
  if (electron?.openExternalUrl) {
    void electron.openExternalUrl(url).catch(() => api.ui.showNotification('Could not open the link.', 'warning'));
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

function openModsFolder(): void {
  const electron = (window as unknown as { electron?: { openModsFolder?: () => Promise<void> } }).electron;
  if (!electron?.openModsFolder) {
    api.ui.showNotification('Could not open the mods folder from here.', 'warning');
    return;
  }
  void electron.openModsFolder().catch(() => api.ui.showNotification('Failed to open the mods folder.', 'error'));
}
