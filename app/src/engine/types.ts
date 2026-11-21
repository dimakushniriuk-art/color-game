export interface PaletteColor {
  /** index in palette array */
  id: number;
  /** number shown to the player (1-based) */
  number: number;
  hex: string;
  rgb: [number, number, number];
}

export interface Region {
  /** index in regions array (also the value stored in idmap) */
  index: number;
  /** original region id from the package (may differ from index) */
  sourceId: number;
  colorId: number;
  area: number;
  /** x0, y0, x1, y1 (inclusive) */
  bbox: [number, number, number, number];
  /** best point to draw the number + max font size (image px) */
  labelX: number;
  labelY: number;
  labelSize: number;
}

export interface Puzzle {
  id: string;
  width: number;
  height: number;
  /** region index per pixel, -1 = no region (background / transparent) */
  idmap: Int32Array;
  /** 1 = outline pixel */
  lines: Uint8Array;
  regions: Region[];
  palette: PaletteColor[];
  /** pixels of region r are pixIdx[pixStart[r] .. pixStart[r+1]) */
  pixStart: Int32Array;
  pixIdx: Int32Array;
  /** region indices grouped by color */
  regionsByColor: number[][];
}

export interface CatalogItem {
  id: string;
  title: string;
  category: string;
  difficulty: 'facile' | 'medio' | 'difficile';
  /** 'demo' = generated in the app; 'remote' = package downloaded from baseUrl */
  source: 'demo' | 'remote';
  baseUrl?: string;
  thumbnailUrl?: string;
  isNew?: boolean;
}
