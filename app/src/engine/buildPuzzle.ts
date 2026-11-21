import type { PaletteColor, Puzzle, Region } from './types';

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function makePalette(hexes: string[]): PaletteColor[] {
  return hexes.map((hex, i) => ({ id: i, number: i + 1, hex, rgb: hexToRgb(hex) }));
}

/**
 * Builds the runtime puzzle from a region map.
 * @param idmap region index per pixel (0..regionCount-1), -1 = empty
 * @param regionColor colorId of each region index
 * @param lines optional outline mask; if missing it is derived from region borders
 * @param sourceIds optional original ids from the package
 */
export function buildPuzzle(
  id: string,
  width: number,
  height: number,
  idmap: Int32Array,
  regionColor: number[],
  palette: PaletteColor[],
  lines?: Uint8Array,
  sourceIds?: number[],
): Puzzle {
  const n = width * height;
  const rc = regionColor.length;

  // outline: pixel whose right/bottom neighbour belongs to another region
  if (!lines) {
    lines = new Uint8Array(n);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const v = idmap[i];
        if (x + 1 < width && idmap[i + 1] !== v) lines[i] = 1;
        else if (y + 1 < height && idmap[i + width] !== v) lines[i] = 1;
      }
    }
  }

  // pixel lists (counting sort) + area + bbox
  const area = new Int32Array(rc);
  const bx0 = new Int32Array(rc).fill(width), by0 = new Int32Array(rc).fill(height);
  const bx1 = new Int32Array(rc).fill(-1), by1 = new Int32Array(rc).fill(-1);
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      const r = idmap[i];
      if (r < 0) continue;
      area[r]++;
      if (x < bx0[r]) bx0[r] = x;
      if (x > bx1[r]) bx1[r] = x;
      if (y < by0[r]) by0[r] = y;
      if (y > by1[r]) by1[r] = y;
    }
  }
  const pixStart = new Int32Array(rc + 1);
  for (let r = 0; r < rc; r++) pixStart[r + 1] = pixStart[r] + area[r];
  const fillPos = pixStart.slice(0, rc);
  const pixIdx = new Int32Array(pixStart[rc]);
  for (let i = 0; i < n; i++) {
    const r = idmap[i];
    if (r >= 0) pixIdx[fillPos[r]++] = i;
  }

  // chamfer distance to region border -> number placement (pole of inaccessibility)
  const dist = new Float32Array(n);
  const INF = 1e9;
  for (let i = 0; i < n; i++) dist[i] = lines[i] || idmap[i] < 0 ? 0 : INF;
  const A = 1, B = 1.4142;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let d = dist[i];
      if (d === 0) continue;
      const r = idmap[i];
      if (x > 0) d = Math.min(d, idmap[i - 1] === r ? dist[i - 1] + A : A);
      else d = Math.min(d, A);
      if (y > 0) {
        d = Math.min(d, idmap[i - width] === r ? dist[i - width] + A : A);
        if (x > 0) d = Math.min(d, idmap[i - width - 1] === r ? dist[i - width - 1] + B : B);
        if (x + 1 < width) d = Math.min(d, idmap[i - width + 1] === r ? dist[i - width + 1] + B : B);
      } else d = Math.min(d, A);
      dist[i] = d;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let d = dist[i];
      if (d === 0) continue;
      const r = idmap[i];
      if (x + 1 < width) d = Math.min(d, idmap[i + 1] === r ? dist[i + 1] + A : A);
      else d = Math.min(d, A);
      if (y + 1 < height) {
        d = Math.min(d, idmap[i + width] === r ? dist[i + width] + A : A);
        if (x + 1 < width) d = Math.min(d, idmap[i + width + 1] === r ? dist[i + width + 1] + B : B);
        if (x > 0) d = Math.min(d, idmap[i + width - 1] === r ? dist[i + width - 1] + B : B);
      } else d = Math.min(d, A);
      dist[i] = d;
    }
  }
  const best = new Float32Array(rc).fill(-1);
  const bestI = new Int32Array(rc).fill(-1);
  for (let i = 0; i < n; i++) {
    const r = idmap[i];
    if (r >= 0 && dist[i] > best[r]) { best[r] = dist[i]; bestI[r] = i; }
  }

  const regions: Region[] = [];
  const regionsByColor: number[][] = palette.map(() => []);
  for (let r = 0; r < rc; r++) {
    const bi = bestI[r] >= 0 ? bestI[r] : pixIdx[pixStart[r]] ?? 0;
    const color = regionColor[r];
    regions.push({
      index: r,
      sourceId: sourceIds ? sourceIds[r] : r,
      colorId: color,
      area: area[r],
      bbox: [bx0[r], by0[r], bx1[r], by1[r]],
      labelX: (bi % width) + 0.5,
      labelY: Math.floor(bi / width) + 0.5,
      labelSize: Math.max(0.5, best[r]) * 1.25,
    });
    if (area[r] > 0 && regionsByColor[color]) regionsByColor[color].push(r);
  }

  return { id, width, height, idmap, lines, regions, palette, pixStart, pixIdx, regionsByColor };
}
