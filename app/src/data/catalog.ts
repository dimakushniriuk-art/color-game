import { buildPuzzle, makePalette } from '../engine/buildPuzzle';
import { segment } from '../engine/segment';
import type { CatalogItem, Puzzle } from '../engine/types';
import { DEMO_SCENES, renderScene } from './demoScenes';
import { loadPackage } from './packageLoader';

/**
 * Remote catalogue: set VITE_CATALOG_URL (e.g. a public Supabase Storage file or a Vercel route)
 * returning { "items": [ { id, title, category, difficulty, baseUrl, thumbnailUrl?, isNew? } ] }.
 * baseUrl is the folder of a published package (palette.json, regions.json, regions_idmap.png, outline.png).
 */
const CATALOG_URL = import.meta.env.VITE_CATALOG_URL as string | undefined;
const DEMO_SIZE = 800;

const demoItems: CatalogItem[] = DEMO_SCENES.map((s, i) => ({
  id: s.id, title: s.title, category: s.category, difficulty: s.difficulty, source: 'demo', isNew: i < 2,
}));

export async function getCatalog(): Promise<CatalogItem[]> {
  if (!CATALOG_URL) return demoItems;
  try {
    const res = await fetch(CATALOG_URL, { cache: 'no-cache' });
    const j = await res.json();
    const remote: CatalogItem[] = (j.items ?? []).map((it: any) => ({ ...it, source: 'remote' }));
    return [...remote, ...demoItems];
  } catch (e) {
    console.warn('Catalogo remoto non raggiungibile, uso i disegni demo', e);
    return demoItems;
  }
}

const cache = new Map<string, Promise<Puzzle>>();

export function loadPuzzle(item: CatalogItem): Promise<Puzzle> {
  let p = cache.get(item.id);
  if (!p) {
    p = item.source === 'remote' && item.baseUrl ? loadPackage(item.id, item.baseUrl) : buildDemo(item.id);
    cache.set(item.id, p);
    p.catch(() => cache.delete(item.id));
  }
  return p;
}

async function buildDemo(id: string): Promise<Puzzle> {
  const scene = DEMO_SCENES.find((s) => s.id === id);
  if (!scene) throw new Error('Disegno non trovato');
  await new Promise((r) => setTimeout(r, 0)); // let the UI paint first
  const { rgba, cellSize } = renderScene(scene, DEMO_SIZE);
  const pal = makePalette(scene.palette);
  const seed = [...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);
  const { idmap, regionColor } = segment(rgba, DEMO_SIZE, DEMO_SIZE, pal.map((p) => p.rgb), cellSize, 60, seed);
  // drop unused colours and renumber
  const used = [...new Set(regionColor)].sort((a, b) => a - b);
  const remap = new Map(used.map((c, i) => [c, i]));
  const palette = makePalette(used.map((c) => scene.palette[c]));
  return buildPuzzle(id, DEMO_SIZE, DEMO_SIZE, idmap, regionColor.map((c) => remap.get(c)!), palette);
}

/** "Disegno del giorno": same pick for everybody on the same day */
export function pickDaily(items: CatalogItem[]): CatalogItem | null {
  if (!items.length) return null;
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  return items[day % items.length];
}
