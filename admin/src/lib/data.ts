import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Artwork, Publication } from './types';

export async function fetchArtworks(): Promise<Artwork[]> {
  const { data, error } = await supabase.from('artworks').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data as Artwork[];
}

export async function fetchPublications(from?: string, to?: string): Promise<Publication[]> {
  let q = supabase.from('publications').select('*').order('publish_at');
  if (from) q = q.gte('publish_at', from);
  if (to) q = q.lt('publish_at', to);
  const { data, error } = await q;
  if (error) throw error;
  return data as Publication[];
}

export async function createArtwork(fields: Partial<Artwork> = {}): Promise<Artwork> {
  const { data, error } = await supabase.from('artworks').insert(fields).select().single();
  if (error) throw error;
  return data as Artwork;
}

export async function updateArtwork(id: string, fields: Partial<Artwork>): Promise<Artwork> {
  const { data, error } = await supabase.from('artworks').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data as Artwork;
}

/** Piccolo hook: carica, espone errore e una funzione per ricaricare. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    fn().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message ?? String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, setData, error, reload };
}
