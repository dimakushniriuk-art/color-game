// Turns a flat-colour picture into regions (used by the demo drawings).
// Real drawings come already segmented from the Python engine.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SegmentResult {
  idmap: Int32Array;
  regionColor: number[];
}

/**
 * @param rgba picture pixels
 * @param paletteRgb colours used to draw it (pixels snap to the nearest)
 * @param cellSize mosaic cell size in px (0 = none): splits big areas into several regions
 * @param minArea components smaller than this merge into a neighbour
 */
export function segment(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  paletteRgb: [number, number, number][],
  cellSize: number,
  minArea: number,
  seed: number,
): SegmentResult {
  const n = w * h;
  const color = new Int16Array(n);
  const cache = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const key = (r << 16) | (g << 8) | b;
    let c = cache.get(key);
    if (c === undefined) {
      let bd = Infinity;
      c = 0;
      for (let k = 0; k < paletteRgb.length; k++) {
        const p = paletteRgb[k];
        const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
        if (d < bd) { bd = d; c = k; }
      }
      cache.set(key, c);
    }
    color[i] = c;
  }

  // jittered-grid Voronoi cells
  const cell = new Int32Array(n);
  if (cellSize > 0) {
    const rnd = mulberry32(seed);
    const gw = Math.ceil(w / cellSize) + 1, gh = Math.ceil(h / cellSize) + 1;
    const sx = new Float32Array(gw * gh), sy = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++)
      for (let gx = 0; gx < gw; gx++) {
        sx[gy * gw + gx] = (gx + 0.15 + rnd() * 0.7) * cellSize;
        sy[gy * gw + gx] = (gy + 0.15 + rnd() * 0.7) * cellSize;
      }
    for (let y = 0; y < h; y++) {
      const cy = Math.floor(y / cellSize);
      for (let x = 0; x < w; x++) {
        const cx = Math.floor(x / cellSize);
        let bd = Infinity, best = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = cy + dy;
          if (yy < 0 || yy >= gh) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = cx + dx;
            if (xx < 0 || xx >= gw) continue;
            const k = yy * gw + xx;
            const d = (sx[k] - x) ** 2 + (sy[k] - y) ** 2;
            if (d < bd) { bd = d; best = k; }
          }
        }
        cell[y * w + x] = best;
      }
    }
  }

  // connected components (4-connectivity) on (colour, cell)
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a: number) => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  };
  const same = (a: number, b: number) => color[a] === color[b] && cell[a] === cell[b];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0 && same(i, i - 1)) { const a = find(i), b = find(i - 1); if (a !== b) parent[a] = b; }
      if (y > 0 && same(i, i - w)) { const a = find(i), b = find(i - w); if (a !== b) parent[a] = b; }
    }
  const label = new Int32Array(n).fill(-1);
  const rootLabel = new Map<number, number>();
  const compColor: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let l = rootLabel.get(r);
    if (l === undefined) { l = compColor.length; rootLabel.set(r, l); compColor.push(color[i]); }
    label[i] = l;
  }

  // merge tiny components into the neighbour sharing the longest border
  const nc = compColor.length;
  const area = new Int32Array(nc);
  for (let i = 0; i < n; i++) area[label[i]]++;
  const start = new Int32Array(nc + 1);
  for (let c = 0; c < nc; c++) start[c + 1] = start[c] + area[c];
  const pos = start.slice(0, nc);
  const pix = new Int32Array(n);
  for (let i = 0; i < n; i++) pix[pos[label[i]]++] = i;
  const remap = new Int32Array(nc);
  for (let c = 0; c < nc; c++) remap[c] = c;
  const res = (c: number) => { while (remap[c] !== c) { remap[c] = remap[remap[c]]; c = remap[c]; } return c; };
  const curArea = Int32Array.from(area);
  const order = Array.from({ length: nc }, (_, i) => i).filter((c) => area[c] < minArea).sort((a, b) => area[a] - area[b]);
  for (const c of order) {
    if (res(c) !== c || curArea[c] >= minArea) continue;
    const counts = new Map<number, number>();
    for (let k = start[c]; k < start[c + 1]; k++) {
      const i = pix[k], x = i % w;
      const nb = [x > 0 ? i - 1 : -1, x + 1 < w ? i + 1 : -1, i - w, i + w];
      for (const j of nb) {
        if (j < 0 || j >= n) continue;
        const o = res(label[j]);
        if (o !== c) counts.set(o, (counts.get(o) || 0) + 1);
      }
    }
    let bestO = -1, bestN = 0;
    counts.forEach((v, o) => { if (v > bestN) { bestN = v; bestO = o; } });
    if (bestO >= 0) { remap[c] = bestO; curArea[bestO] += curArea[c]; }
  }

  const finalIdx = new Int32Array(nc).fill(-1);
  const regionColor: number[] = [];
  const idmap = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const r = res(label[i]);
    if (finalIdx[r] < 0) { finalIdx[r] = regionColor.length; regionColor.push(compColor[r]); }
    idmap[i] = finalIdx[r];
  }
  return { idmap, regionColor };
}
