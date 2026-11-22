export type Difficulty = 'facile' | 'medio' | 'difficile';
export type Status = 'bozza' | 'pronta' | 'archiviata';

export interface ArtImage { path: string; caption?: string }

export interface Artwork {
  id: string;
  title: string;
  artist: string | null;
  year: string | null;
  technique: string | null;
  dimensions: string | null;
  location: string | null;
  movement: string | null;
  category: string;
  difficulty: Difficulty;
  description: string;
  wiki_url: string | null;
  tags: string[];
  images: ArtImage[];
  package_path: string | null;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  colors: number | null;
  zones: number | null;
  status: Status;
  created_at: string;
  updated_at: string;
}

export interface Publication {
  id: string;
  artwork_id: string;
  publish_at: string;
  featured: boolean;
  note: string | null;
}

export const STATUS_LABEL: Record<Status, string> = { bozza: 'Bozza', pronta: 'Pronta', archiviata: 'Archiviata' };
export const DIFF_LABEL: Record<Difficulty, string> = { facile: 'Facile', medio: 'Medio', difficile: 'Difficile' };
