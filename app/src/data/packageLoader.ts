// Loads a game package exported by the Python engine (spec sect. 15).
//
// ⚠️ ASSUMPTIONS to check against engine/ export code before going live:
//   - regions_idmap.png: region id encoded as R + G*256 + B*65536, alpha 0 = no region
//   - palette.json: array (or {colors|palette:[]}) of {color_id|id, color_number|number, hex | rgb:[r,g,b]}
//   - regions.json: array (or {regions:[]}) of {region_id|id, color_id|colorId}
//   - outline.png (optional): dark or opaque pixels = outline
// If the engine uses a different encoding, change only this file.

import { buildPuzzle, hexToRgb } from '../engine/buildPuzzle';
import type { PaletteColor, Puzzle } from '../engine/types';

async function loadImageData(url: string): Promise<ImageData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, bmp.width, bmp.height);
}

const arr = (j: any, ...keys: string[]): any[] => {
  if (Array.isArray(j)) return j;
  for (const k of keys) if (Array.isArray(j?.[k])) return j[k];
  throw new Error('Formato JSON non riconosciuto');
};

export async function loadPackage(id: string, baseUrl: string): Promise<Puzzle> {
  const base = baseUrl.replace(/\/?$/, '/');
  const [palJ, regJ, idImg] = await Promise.all([
    fetch(base + 'palette.json').then((r) => r.json()),
    fetch(base + 'regions.json').then((r) => r.json()),
    loadImageData(base + 'regions_idmap.png'),
  ]);
  let outlineImg: ImageData | null = null;
  try { outlineImg = await loadImageData(base + 'outline.png'); } catch { /* optional */ }

  const rawPal = arr(palJ, 'colors', 'palette');
  const colorIndex = new Map<number, number>();
  const palette: PaletteColor[] = rawPal.map((p: any, i: number) => {
    const cid = p.color_id ?? p.id ?? i;
    colorIndex.set(cid, i);
    const rgb: [number, number, number] = p.rgb ?? hexToRgb(p.hex);
    const hex = p.hex ?? '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
    return { id: i, number: p.color_number ?? p.number ?? i + 1, hex, rgb };
  });

  const rawReg = arr(regJ, 'regions');
  const regionIndex = new Map<number, number>();
  const regionColor: number[] = [];
  const sourceIds: number[] = [];
  rawReg.forEach((r: any) => {
    const rid = r.region_id ?? r.id;
    regionIndex.set(rid, regionColor.length);
    regionColor.push(colorIndex.get(r.color_id ?? r.colorId) ?? 0);
    sourceIds.push(rid);
  });

  const { width, height, data } = idImg;
  const n = width * height;
  const idmap = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] === 0) { idmap[i] = -1; continue; }
    const rid = data[i * 4] | (data[i * 4 + 1] << 8) | (data[i * 4 + 2] << 16);
    idmap[i] = regionIndex.get(rid) ?? -1;
  }

  let lines: Uint8Array | undefined;
  if (outlineImg && outlineImg.width === width && outlineImg.height === height) {
    lines = new Uint8Array(n);
    const d = outlineImg.data;
    for (let i = 0; i < n; i++) {
      const a = d[i * 4 + 3], lum = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
      lines[i] = a > 128 && lum < 128 ? 1 : 0;
    }
  }
  return buildPuzzle(id, width, height, idmap, regionColor, palette, lines, sourceIds);
}
