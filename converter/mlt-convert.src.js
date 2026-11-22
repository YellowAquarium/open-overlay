/**
 * Open Overlay - converts MapLibre Tiles (MLT) to classic Mapbox Vector Tiles (MVT).
 *
 * openrailwaymap.app's server caches most tiles in the newer MLT format, which the game's map
 * engine can't read. Converting them here lets the proxy use those fast cached copies instead of
 * asking the server to build every tile from scratch. Bundled into mlt-convert.js (no install
 * needed) by `npm run build:converter`.
 */
import { decodeTile } from '@maplibre/mlt';
import vtpbf from 'vt-pbf';

// MLT geometry types -> MVT geometry types (1 point, 2 line, 3 polygon).
const MVT_TYPE = { 0: 1, 1: 2, 2: 3, 3: 1, 4: 2, 5: 3 };

function mvtValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  // Nested values (lists/maps) have no MVT equivalent: keep them as JSON text.
  try {
    return JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? Number(inner) : inner));
  } catch {
    return undefined;
  }
}

function mvtId(id) {
  if (id === undefined || id === null) return undefined;
  const number = typeof id === 'bigint' ? Number(id) : id;
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

/** True if the bytes look like an MVT tile (a list of layers starts with byte 0x1a) or are empty. */
export function looksLikeMvt(bytes) {
  return !bytes || bytes.length === 0 || bytes[0] === 0x1a;
}

/** Converts an MLT tile to an MVT tile. Throws if the bytes can't be decoded. */
export function mltToMvt(bytes) {
  const tables = decodeTile(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const layers = {};
  for (const table of tables) {
    const features = table.getFeatures().map((feature) => {
      const properties = {};
      for (const [key, value] of Object.entries(feature.properties || {})) {
        const converted = mvtValue(value);
        if (converted !== undefined) properties[key] = converted;
      }
      const rings = feature.geometry.coordinates.map((ring) => ring.map((point) => ({ x: point.x, y: point.y })));
      return {
        id: mvtId(feature.id),
        type: MVT_TYPE[feature.geometry.type] ?? 1,
        properties,
        loadGeometry: () => rings,
      };
    });
    layers[table.name] = {
      name: table.name,
      version: 2,
      extent: table.extent || 4096,
      length: features.length,
      feature: (index) => features[index],
    };
  }
  return Buffer.from(vtpbf.fromVectorTileJs({ layers }));
}

// ---------------------------------------------------------------------------
// Stand-in tiles: while a tile is still downloading, build one from saved tiles of other zoom
// levels (a parent tile enlarged, or child tiles shrunk and combined).
// ---------------------------------------------------------------------------
import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';

const TARGET_EXTENT = 4096;
const MARGIN = 256;

/**
 * Builds one MVT tile from parts. Each part is an MVT tile plus how its coordinates map into the
 * target tile: target = source * scale + offset (in units of the target tile's 4096 extent, after
 * normalising each source layer to 4096). Features entirely outside the target are dropped.
 *
 * @param {Array<{ bytes: Uint8Array, scale: number, dx: number, dy: number }>} parts
 * @returns {Buffer | null} the tile, or null if nothing in the parts falls inside the target
 */
export function composeTile(parts) {
  const merged = new Map();
  for (const part of parts) {
    let tile;
    try {
      tile = new VectorTile(new Protobuf(part.bytes));
    } catch {
      continue;
    }
    for (const [name, layer] of Object.entries(tile.layers)) {
      const norm = TARGET_EXTENT / (layer.extent || TARGET_EXTENT);
      const scale = part.scale * norm;
      let out = merged.get(name);
      if (!out) {
        out = [];
        merged.set(name, out);
      }
      for (let i = 0; i < layer.length; i += 1) {
        const feature = layer.feature(i);
        let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
        const rings = feature.loadGeometry().map((ring) => ring.map((point) => {
          const x = Math.round(point.x * scale + part.dx);
          const y = Math.round(point.y * scale + part.dy);
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          return { x, y };
        }));
        if (maxX < -MARGIN || maxY < -MARGIN || minX > TARGET_EXTENT + MARGIN || minY > TARGET_EXTENT + MARGIN) continue;
        out.push({
          id: feature.id,
          type: feature.type,
          properties: { ...feature.properties },
          loadGeometry: () => rings,
        });
      }
    }
  }
  const layers = {};
  for (const [name, features] of merged) {
    if (!features.length) continue;
    layers[name] = { name, version: 2, extent: TARGET_EXTENT, length: features.length, feature: (index) => features[index] };
  }
  if (!Object.keys(layers).length) return null;
  return Buffer.from(vtpbf.fromVectorTileJs({ layers }));
}

/** Feature count per layer of an MVT tile, e.g. { railway_line_high: 120 } (null if unreadable). */
export function summarizeMvt(bytes) {
  if (!bytes || !bytes.length) return {};
  try {
    const tile = new VectorTile(new Protobuf(bytes));
    const counts = {};
    for (const [name, layer] of Object.entries(tile.layers)) counts[name] = layer.length;
    return counts;
  } catch {
    return null;
  }
}
