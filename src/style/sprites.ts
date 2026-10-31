import { spriteImageId } from './prepare';

type SpriteEntry = {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelRatio?: number;
  sdf?: boolean;
  stretchX?: Array<[number, number]>;
  stretchY?: Array<[number, number]>;
  content?: [number, number, number, number];
};

type Atlas = {
  spriteId: string;
  entries: Record<string, SpriteEntry>;
  pixels: Uint8ClampedArray;
  width: number;
};

export type SpriteImage = {
  data: { width: number; height: number; data: Uint8Array };
  options: {
    pixelRatio: number;
    sdf: boolean;
    stretchX?: Array<[number, number]>;
    stretchY?: Array<[number, number]>;
    content?: [number, number, number, number];
  };
};

/**
 * Holds OpenRailwayMap's sprite sheets in memory so missing icons can be
 * handed to MapLibre synchronously from a `styleimagemissing` handler.
 *
 * MapLibre only supports one sprite set per style comfortably, and the game
 * already owns that slot, so icons are served on demand instead of via
 * `addSprite`.
 */
export class SpriteLibrary {
  private atlases = new Map<string, Atlas>();
  private index = new Map<string, { atlas: Atlas; name: string }>();
  private images = new Map<string, SpriteImage>();
  private loadPromise: Promise<void> | null = null;
  private loadedKey: string | null = null;

  async load(spriteUrls: Array<{ id: string; url: string }>): Promise<void> {
    const ratio = (globalThis.devicePixelRatio ?? 1) > 1 ? '@2x' : '';
    const key = `${ratio}|${spriteUrls.map((s) => `${s.id}=${s.url}`).join(',')}`;
    if (this.loadedKey === key) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const atlases = await Promise.all(spriteUrls.map(async ({ id, url }) => {
        try {
          return await loadAtlas(id, `${url}${ratio}`);
        } catch (error) {
          if (!ratio) throw error;
          // Some servers only ship the 1x sheet.
          return loadAtlas(id, url);
        }
      }));
      this.atlases.clear();
      this.index.clear();
      this.images.clear();
      for (const atlas of atlases) {
        this.atlases.set(atlas.spriteId, atlas);
        for (const name of Object.keys(atlas.entries)) {
          this.index.set(spriteImageId(atlas.spriteId, name), { atlas, name });
        }
      }
      this.loadedKey = key;
    })().finally(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  has(imageId: string): boolean {
    return this.index.has(imageId);
  }

  get size(): number {
    return this.index.size;
  }

  get(imageId: string): SpriteImage | null {
    const cached = this.images.get(imageId);
    if (cached) return cached;
    const ref = this.index.get(imageId);
    if (!ref) return null;

    const { atlas, name } = ref;
    const entry = atlas.entries[name];
    const data = new Uint8Array(entry.width * entry.height * 4);
    for (let row = 0; row < entry.height; row += 1) {
      const sourceStart = ((entry.y + row) * atlas.width + entry.x) * 4;
      data.set(atlas.pixels.subarray(sourceStart, sourceStart + entry.width * 4), row * entry.width * 4);
    }
    const image: SpriteImage = {
      data: { width: entry.width, height: entry.height, data },
      options: {
        pixelRatio: entry.pixelRatio ?? 1,
        sdf: entry.sdf ?? atlas.spriteId === 'sdf',
        ...(entry.stretchX ? { stretchX: entry.stretchX } : {}),
        ...(entry.stretchY ? { stretchY: entry.stretchY } : {}),
        ...(entry.content ? { content: entry.content } : {}),
      },
    };
    this.images.set(imageId, image);
    return image;
  }
}

async function loadAtlas(spriteId: string, baseUrl: string): Promise<Atlas> {
  const [entriesResponse, imageResponse] = await Promise.all([
    fetch(`${baseUrl}.json`),
    fetch(`${baseUrl}.png`),
  ]);
  if (!entriesResponse.ok) throw new Error(`Sprite index ${baseUrl}.json returned ${entriesResponse.status}`);
  if (!imageResponse.ok) throw new Error(`Sprite image ${baseUrl}.png returned ${imageResponse.status}`);

  const entries = await entriesResponse.json() as Record<string, SpriteEntry>;
  const bitmap = await createImageBitmap(await imageResponse.blob(), { premultiplyAlpha: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.drawImage(bitmap, 0, 0);
  const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  bitmap.close?.();
  return { spriteId, entries, pixels, width: canvas.width };
}
