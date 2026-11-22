import { buildPuzzle, makePalette } from '../engine/buildPuzzle';
import { segment } from '../engine/segment';
import type { CatalogItem, Puzzle } from '../engine/types';
import { DEMO_SCENES, renderScene } from './demoScenes';
import { loadPackage } from './packageLoader';

/**
 * Catalogo remoto, in ordine di priorità:
 *  1. Supabase (calendario del pannello admin): VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY → rpc get_catalog.
 *     Restituisce solo le opere già uscite (publish_at <= adesso); next_at = prossima uscita.
 *  2. VITE_CATALOG_URL (solo con VITE_SUPABASE_URL=off): JSON { "items": [ { id, title, category, difficulty, baseUrl, thumbnailUrl?, isNew? } ] }.
 * baseUrl è la cartella di un pacchetto (palette.json, regions.json, regions_idmap.png, outline.png).
 * I disegni demo restano sempre in fondo alla galleria.
 */
// Valori predefiniti = progetto Supabase "color-game" (la chiave publishable è pubblica per definizione).
// Per giocare solo coi demo: VITE_SUPABASE_URL=off
const SUPABASE_ENV = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_URL = SUPABASE_ENV === 'off' ? undefined : (SUPABASE_ENV || 'https://vcvboeioopplfqhqpqvf.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_dcPyb3gwCap83RYt-mcWig__ypgYX5S';
const CATALOG_URL = import.meta.env.VITE_CATALOG_URL as string | undefined;
const DEMO_SIZE = 800;
const NEW_DAYS = 3;

const demoItems: CatalogItem[] = DEMO_SCENES.map((s, i) => ({
  id: s.id, title: s.title, category: s.category, difficulty: s.difficulty, source: 'demo', isNew: i < 2,
}));

let dailyId: string | null = null;
let nextAt: number | null = null;

const storageUrl = (path?: string | null) =>
  path ? `${SUPABASE_URL}/storage/v1/object/public/artworks/${path.split('/').map(encodeURIComponent).join('/')}` : undefined;

async function fetchSupabase(): Promise<CatalogItem[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_catalog`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: SUPABASE_KEY!, 'content-type': 'application/json' }, body: '{}',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  dailyId = j.daily_id ?? null;
  nextAt = j.next_at ? new Date(j.next_at).getTime() : null;
  const now = Date.now();
  return (j.items ?? []).map((it: any): CatalogItem => ({
    id: it.id, title: it.title, category: it.category || 'Arte', difficulty: it.difficulty || 'medio', source: 'remote',
    baseUrl: storageUrl(it.packagePath), thumbnailUrl: storageUrl(it.thumbPath),
    artist: it.artist ?? undefined, year: it.year ?? undefined, description: it.description || undefined,
    isNew: now - new Date(it.publishedAt).getTime() < NEW_DAYS * 86400000,
  }));
}

export async function getCatalog(): Promise<CatalogItem[]> {
  try {
    if (SUPABASE_URL && SUPABASE_KEY) return [...(await fetchSupabase()), ...demoItems];
    if (!CATALOG_URL) return demoItems;
    const res = await fetch(CATALOG_URL, { cache: 'no-cache' });
    const j = await res.json();
    const remote: CatalogItem[] = (j.items ?? []).map((it: any) => ({ ...it, source: 'remote' }));
    return [...remote, ...demoItems];
  } catch (e) {
    console.warn('Catalogo remoto non raggiungibile, uso i disegni demo', e);
    return demoItems;
  }
}

/**
 * Tiene il catalogo aggiornato: ricarica all'ora esatta della prossima uscita (next_at),
 * quando l'app torna in primo piano e comunque ogni 5 minuti. Gli elementi invariati
 * mantengono lo stesso oggetto, così le anteprime non vengono rigenerate.
 */
export function watchCatalog(onItems: (items: CatalogItem[]) => void): () => void {
  let prev = new Map<string, { key: string; item: CatalogItem }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;
  const refresh = async () => {
    clearTimeout(timer);
    const items = await getCatalog();
    if (!alive) return;
    const next = new Map<string, { key: string; item: CatalogItem }>();
    const stable = items.map((it) => {
      const key = JSON.stringify(it), old = prev.get(it.id);
      const item = old && old.key === key ? old.item : it;
      next.set(it.id, { key, item });
      return item;
    });
    prev = next;
    onItems(stable);
    const wait = nextAt ? Math.max(1000, nextAt - Date.now() + 1500) : Infinity;
    timer = setTimeout(refresh, Math.min(wait, 5 * 60000));
  };
  const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
  document.addEventListener('visibilitychange', onVisible);
  refresh();
  return () => { alive = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
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

/** "Disegno del giorno": quello del calendario admin, altrimenti uguale per tutti nello stesso giorno */
export function pickDaily(items: CatalogItem[]): CatalogItem | null {
  if (!items.length) return null;
  const scheduled = dailyId && items.find((i) => i.id === dailyId); // scelto nel calendario dell'admin
  if (scheduled) return scheduled;
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  return items[day % items.length];
}
