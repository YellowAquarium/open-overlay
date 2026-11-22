/**
 * Pure transformations that turn the OpenRailwayMap style (as served by the
 * local proxy) into sources + layers that can be injected into the game's
 * MapLibre map without colliding with anything the game owns.
 *
 * Nothing in here touches the DOM or the map, so it is unit-testable.
 */

export type StyleLayer = {
  id: string;
  type: string;
  source?: string;
  'source-layer'?: string;
  minzoom?: number;
  maxzoom?: number;
  filter?: unknown;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  metadata?: unknown;
  [key: string]: unknown;
};

export type StyleSource = Record<string, unknown> & { type: string; url?: string };

export type OrmStyle = {
  version: number;
  sources: Record<string, StyleSource>;
  layers: StyleLayer[];
  sprite?: unknown;
  state?: Record<string, { default?: unknown }>;
  metadata?: Record<string, unknown>;
};

export type PreparedLayer = {
  /** Namespaced layer id used on the game map. */
  id: string;
  /** Layer id in the original OpenRailwayMap style. */
  originalId: string;
  /** Original source id (needed for the feature-details API). */
  originalSource: string;
  /** Layer definition with namespaced source id and global-state keys; opacity NOT yet applied. */
  layer: StyleLayer;
  /** Original opacity paint values, keyed by property, for re-scaling. */
  opacityProps: Record<string, unknown>;
};

export type PreparedStyle = {
  sources: Record<string, StyleSource>;
  layers: PreparedLayer[];
  stateDefaults: Record<string, unknown>;
  spriteUrls: Array<{ id: string; url: string }>;
  droppedLayers: string[];
};

export type PrepareOptions = {
  namespace: string;
  /** Map a global-state key to its namespaced key (native global state). */
  globalStateKey: (key: string) => string;
  /** Sources the overlay cannot stream through the proxy (background / historical / terrain). */
  excludedSources?: Iterable<string>;
  /** Adds ?lang= to sources whose metadata says they support it. */
  language?: string;
  /** Replace font stacks so labels render with the game's glyphs. */
  fonts?: { regular: string[]; bold: string[] } | null;
};

/** Sources that are not OpenRailwayMap data (or need external services) and are skipped. */
export const DEFAULT_EXCLUDED_SOURCES = ['openhistoricalmap', 'dem', 'search'];
const EXCLUDED_LAYER_TYPES = new Set(['background', 'hillshade', 'color-relief', 'sky']);

export const OPACITY_PROPERTIES: Record<string, string[]> = {
  line: ['line-opacity'],
  fill: ['fill-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
  symbol: ['icon-opacity', 'text-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity'],
  heatmap: ['heatmap-opacity'],
  raster: ['raster-opacity'],
};

export function namespacedSourceId(namespace: string, sourceId: string): string {
  return `${namespace}:src:${sourceId}`;
}

export function namespacedLayerId(namespace: string, layerId: string): string {
  return `${namespace}:${layerId}`;
}

/**
 * Walks a style value (expression, layout object, filter...) and lets `visit`
 * replace any array node. Contents of ["literal", ...] are never touched.
 */
export function transformExpression(value: unknown, visit: (node: unknown[]) => unknown | undefined): unknown {
  if (Array.isArray(value)) {
    if (value[0] === 'literal') return value;
    const replaced = visit(value);
    if (replaced !== undefined) return replaced;
    return value.map((child) => transformExpression(child, visit));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = transformExpression(child, visit);
    }
    return out;
  }
  return value;
}

/** Renames ["global-state", key] references. */
export function renameGlobalState(value: unknown, rename: (key: string) => string): unknown {
  return transformExpression(value, (node) => {
    if (node[0] === 'global-state' && typeof node[1] === 'string' && node.length === 2) {
      return ['global-state', rename(node[1])];
    }
    return undefined;
  });
}

/**
 * Replaces ["global-state", key] with constant values. Used on older MapLibre
 * builds that do not support global state; the layers are rebuilt whenever
 * the state changes.
 */
export function bakeGlobalState(value: unknown, state: Record<string, unknown>, keyOf: (namespacedKey: string) => string): unknown {
  return transformExpression(value, (node) => {
    if (node[0] === 'global-state' && typeof node[1] === 'string' && node.length === 2) {
      return toLiteral(state[keyOf(node[1])] ?? null);
    }
    return undefined;
  });
}

export function toLiteral(value: unknown): unknown {
  if (value !== null && typeof value === 'object') return ['literal', value];
  return value;
}

export function collectGlobalStateKeys(value: unknown, into = new Set<string>()): Set<string> {
  transformExpression(value, (node) => {
    if (node[0] === 'global-state' && typeof node[1] === 'string') into.add(node[1]);
    return undefined;
  });
  return into;
}

function isZoomInput(input: unknown): boolean {
  return Array.isArray(input) && input.length === 1 && input[0] === 'zoom';
}

/**
 * Multiplies an opacity paint value by `factor` while keeping it a valid
 * MapLibre expression (zoom curves must stay top-level, so their outputs are
 * scaled instead of wrapping the whole curve).
 */
export function scaleOpacity(value: unknown, factor: number): unknown {
  const f = Math.round(Math.min(1, Math.max(0, factor)) * 1000) / 1000;
  if (value === undefined || value === null) return f;
  if (f === 1) return value;
  if (typeof value === 'number') return Math.round(value * f * 1000) / 1000;

  if (Array.isArray(value)) {
    const op = value[0];
    if ((op === 'interpolate' || op === 'interpolate-hcl' || op === 'interpolate-lab') && isZoomInput(value[2])) {
      return value.map((item, index) => (index >= 4 && index % 2 === 0 ? scaleOpacity(item, f) : item));
    }
    if (op === 'step' && isZoomInput(value[1])) {
      return value.map((item, index) => (index >= 2 && index % 2 === 0 ? scaleOpacity(item, f) : item));
    }
    return ['*', value, f];
  }

  // Legacy function syntax: { stops: [[z, v], ...] }
  if (value && typeof value === 'object' && Array.isArray((value as { stops?: unknown }).stops)) {
    const fn = value as { stops: Array<[unknown, unknown]> };
    return {
      ...fn,
      stops: fn.stops.map(([z, v]) => [z, typeof v === 'number' ? Math.round(v * f * 1000) / 1000 : v]),
    };
  }
  return value;
}

/** Applies the overlay opacity to every opacity paint property of a layer. */
export function applyOpacity(prepared: PreparedLayer, factor: number): StyleLayer {
  const props = OPACITY_PROPERTIES[prepared.layer.type] ?? [];
  if (!props.length) return prepared.layer;
  const paint = { ...(prepared.layer.paint ?? {}) };
  for (const prop of props) {
    paint[prop] = scaleOpacity(prepared.opacityProps[prop], factor);
  }
  return { ...prepared.layer, paint };
}

export function opacityPaintValues(prepared: PreparedLayer, factor: number): Record<string, unknown> {
  const props = OPACITY_PROPERTIES[prepared.layer.type] ?? [];
  const out: Record<string, unknown> = {};
  for (const prop of props) out[prop] = scaleOpacity(prepared.opacityProps[prop], factor);
  return out;
}

/** Swaps text-font stacks to fonts that the game's glyph server provides. */
export function replaceFonts(layout: Record<string, unknown> | undefined, fonts: { regular: string[]; bold: string[] }): Record<string, unknown> | undefined {
  if (!layout || layout['text-font'] === undefined) return layout;
  const current = layout['text-font'];
  const isBold = JSON.stringify(current).toLowerCase().includes('bold');
  return { ...layout, 'text-font': isBold ? fonts.bold : fonts.regular };
}

function withLanguage(url: string, language: string | undefined): string {
  if (!language) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}lang=${encodeURIComponent(language)}`;
}

export function prepareStyle(style: OrmStyle, options: PrepareOptions): PreparedStyle {
  const excluded = new Set(options.excludedSources ?? DEFAULT_EXCLUDED_SOURCES);
  const sources: Record<string, StyleSource> = {};

  for (const [id, source] of Object.entries(style.sources ?? {})) {
    if (excluded.has(id) || !source || typeof source !== 'object') continue;
    if (source.type === 'raster-dem') continue;
    const next: StyleSource = { ...source };
    const supports = ((source.metadata as { supports?: string[] } | undefined)?.supports) ?? [];
    if (typeof next.url === 'string' && supports.includes('language')) {
      next.url = withLanguage(next.url, options.language);
    }
    delete next.metadata;
    // The proxy serves classic vector tiles (MVT); never ask the game to decode MLT.
    delete next.encoding;
    sources[namespacedSourceId(options.namespace, id)] = next;
  }

  const layers: PreparedLayer[] = [];
  const droppedLayers: string[] = [];

  for (const original of style.layers ?? []) {
    if (!original || typeof original.id !== 'string') continue;
    if (EXCLUDED_LAYER_TYPES.has(original.type) || !original.source || excluded.has(original.source) ||
      !sources[namespacedSourceId(options.namespace, original.source)]) {
      droppedLayers.push(original.id);
      continue;
    }

    const renamed = renameGlobalState(original, options.globalStateKey) as StyleLayer;
    const id = namespacedLayerId(options.namespace, original.id);
    const layout = options.fonts ? replaceFonts(renamed.layout, options.fonts) : renamed.layout;
    const layer: StyleLayer = {
      ...renamed,
      id,
      source: namespacedSourceId(options.namespace, original.source),
      ...(layout ? { layout } : {}),
    };
    delete layer.metadata;

    const opacityProps: Record<string, unknown> = {};
    for (const prop of OPACITY_PROPERTIES[layer.type] ?? []) {
      if (layer.paint && prop in layer.paint) opacityProps[prop] = layer.paint[prop];
    }

    layers.push({ id, originalId: original.id, originalSource: original.source, layer, opacityProps });
  }

  const stateDefaults: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(style.state ?? {})) {
    stateDefaults[key] = spec?.default ?? null;
  }

  const spriteUrls: Array<{ id: string; url: string }> = [];
  if (Array.isArray(style.sprite)) {
    for (const entry of style.sprite as Array<{ id?: string; url?: string }>) {
      if (entry && typeof entry.url === 'string') spriteUrls.push({ id: entry.id ?? 'default', url: entry.url });
    }
  } else if (typeof style.sprite === 'string') {
    spriteUrls.push({ id: 'default', url: style.sprite });
  }

  return { sources, layers, stateDefaults, spriteUrls, droppedLayers };
}

/** Image id used by the style for an icon from a given sprite sheet. */
export function spriteImageId(spriteId: string, iconName: string): string {
  return spriteId === 'default' ? iconName : `${spriteId}:${iconName}`;
}

const EXPRESSION_OPERATORS = new Set([
  'get', 'literal', 'case', 'match', 'coalesce', 'step', 'interpolate', 'concat', 'to-string',
  'string', 'array', 'global-state', 'var', 'let', 'format',
]);

/** Picks a font stack for regular and bold labels from the game's own symbol layers. */
export function detectGameFonts(layers: Array<{ type?: string; layout?: Record<string, unknown> }>): { regular: string[]; bold: string[] } | null {
  const stacks: string[][] = [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    const font = layer.layout?.['text-font'];
    if (Array.isArray(font) && font.length && font.every((item) => typeof item === 'string') &&
      !EXPRESSION_OPERATORS.has(font[0] as string)) {
      stacks.push(font as string[]);
    }
  }
  if (!stacks.length) return null;
  const isBold = (stack: string[]) => stack.some((name) => /bold|heavy|black|semibold/i.test(name));
  const regular = stacks.find((stack) => !isBold(stack)) ?? stacks[0];
  const bold = stacks.find(isBold) ?? regular;
  return { regular, bold };
}

/** Parses a CSS colour and reports whether it is dark (for the "auto" theme). */
export function isDarkColor(color: unknown): boolean | null {
  if (typeof color !== 'string') return null;
  const value = color.trim().toLowerCase();
  let r: number; let g: number; let b: number;
  let match = value.match(/^#([0-9a-f]{3,8})$/);
  if (match) {
    const hex = match[1];
    const full = hex.length <= 4 ? hex.split('').map((c) => c + c).join('') : hex;
    r = parseInt(full.slice(0, 2), 16); g = parseInt(full.slice(2, 4), 16); b = parseInt(full.slice(4, 6), 16);
  } else if ((match = value.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/))) {
    r = Number(match[1]); g = Number(match[2]); b = Number(match[3]);
  } else if ((match = value.match(/^hsla?\(\s*([\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%/))) {
    return Number(match[3]) < 45;
  } else {
    return null;
  }
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.45;
}
