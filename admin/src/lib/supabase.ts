import { createClient } from '@supabase/supabase-js';

// La chiave "publishable" è pubblica per definizione: i dati sono protetti dalle regole RLS
// (solo le email in team_members possono leggere/scrivere opere e calendario).
const env = import.meta.env;
export const SUPABASE_URL: string = env.VITE_SUPABASE_URL || 'https://vcvboeioopplfqhqpqvf.supabase.co';
const SUPABASE_KEY: string = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dcPyb3gwCap83RYt-mcWig__ypgYX5S';
export const STUDIO_URL: string = env.VITE_STUDIO_URL || 'https://color-game-studio.vercel.app';
export const APP_URL: string = env.VITE_APP_URL || 'https://color-game-app-nine.vercel.app';

export const BUCKET = 'artworks';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export async function upload(path: string, data: Blob | Uint8Array, contentType: string) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, data, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(`Caricamento di ${path.split('/').pop()} non riuscito: ${error.message}`);
}

/** Cancella tutti i file sotto una cartella del bucket (un livello di sottocartelle). */
export async function removeFolder(prefix: string) {
  const { data } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (!data?.length) return;
  const files: string[] = [];
  for (const f of data) {
    if (f.id) files.push(`${prefix}/${f.name}`);
    else {
      const sub = await supabase.storage.from(BUCKET).list(`${prefix}/${f.name}`, { limit: 1000 });
      sub.data?.forEach((s) => files.push(`${prefix}/${f.name}/${s.name}`));
    }
  }
  if (files.length) await supabase.storage.from(BUCKET).remove(files);
}
