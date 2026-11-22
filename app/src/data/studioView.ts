// Anteprime delle opere vere come nel blocco 4 dello Studio: sketch sopra, zone colorate con i pezzi dell'originale.
// Usato da miniature della galleria e schermata finale (rivedi / salva). Il gioco vero è public/gioco/app.html.

export interface StudioView {
  w: number;
  h: number;
  /** zona di ogni pixel (alla dimensione ridotta) */
  zone: Int32Array;
  /** colori da mostrare nelle zone fatte: originale (o colorata) alla dimensione ridotta */
  color: Uint8ClampedArray;
  /** linee dello sketch, trasparenti, già colorate */
  sketch: HTMLCanvasElement | null;
}

const cache = new Map<string, Promise<StudioView>>();

async function bitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await createImageBitmap(await r.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  } catch { return null; }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return { c, g: c.getContext('2d', { willReadFrequently: true })! };
}

function lineColor(): string {
  try { return localStorage.getItem('colora_colLinee') || '#1c1c1c'; } catch { return '#1c1c1c'; }
}

async function build(base: string, size: number): Promise<StudioView> {
  const b = base.replace(/\/?$/, '/');
  const [map, orig, col, schizzo, linee, outline] = await Promise.all(
    ['regions_idmap.png', 'originale.jpg', 'colorata.png', 'schizzo.png', 'linee.png', 'outline.png'].map((n) => bitmap(b + n)),
  );
  if (!map) throw new Error('mappa delle zone non trovata');
  const W = map.width, H = map.height, k = Math.min(1, size / Math.max(W, H));
  const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));

  // zone: lettura a piena risoluzione, poi campionamento al pixel più vicino
  const full = canvas(W, H); full.g.drawImage(map, 0, 0);
  const md = full.g.getImageData(0, 0, W, H).data, zone = new Int32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(H - 1, Math.floor((y + 0.5) / k));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(W - 1, Math.floor((x + 0.5) / k)), o = (sy * W + sx) * 4;
      zone[y * w + x] = md[o] | (md[o + 1] << 8) | (md[o + 2] << 16);
    }
  }

  const ref = orig ?? col, cc = canvas(w, h);
  cc.g.fillStyle = '#fff'; cc.g.fillRect(0, 0, w, h);
  if (ref) { cc.g.imageSmoothingQuality = 'high'; cc.g.drawImage(ref, 0, 0, w, h); }
  const color = cc.g.getImageData(0, 0, w, h).data;

  // sketch: come nel blocco 4 (schizzo ad alta risoluzione, altrimenti le linee scure del pacchetto)
  let sketch: HTMLCanvasElement | null = null;
  const sc = canvas(w, h);
  sc.g.imageSmoothingQuality = 'high';
  if (schizzo) {
    sc.g.drawImage(schizzo, 0, 0, w, h);
  } else if (linee || outline) {
    const src = (linee ?? outline)!, t = canvas(src.width, src.height); t.g.drawImage(src, 0, 0);
    const d = t.g.getImageData(0, 0, src.width, src.height);
    for (let i = 0; i < d.data.length; i += 4) { const l = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]; d.data[i + 3] = l < 150 ? 255 : 0; }
    t.g.putImageData(d, 0, 0); sc.g.drawImage(t.c, 0, 0, w, h);
  }
  if (schizzo || linee || outline) {
    sc.g.globalCompositeOperation = 'source-in'; sc.g.fillStyle = lineColor(); sc.g.fillRect(0, 0, w, h);
    sketch = sc.c;
  }
  return { w, h, zone, color, sketch };
}

export function loadStudioView(base: string, size: number): Promise<StudioView> {
  const key = `${base}@${size}`;
  let p = cache.get(key);
  if (!p) { p = build(base, size); cache.set(key, p); p.catch(() => cache.delete(key)); }
  return p;
}

/** filled: zone già colorate (null = tutte). Disegna su ctx alle dimensioni della vista. */
export function paintStudio(v: StudioView, filled: Set<number> | null, ctx: CanvasRenderingContext2D, withSketch = true) {
  const img = ctx.createImageData(v.w, v.h), d = img.data;
  for (let i = 0, n = v.w * v.h; i < n; i++) {
    const o = i * 4;
    if (!filled || filled.has(v.zone[i])) { d[o] = v.color[o]; d[o + 1] = v.color[o + 1]; d[o + 2] = v.color[o + 2]; }
    else { d[o] = d[o + 1] = d[o + 2] = 255; }
    d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (withSketch && v.sketch) ctx.drawImage(v.sketch, 0, 0);
}

export async function studioThumbnail(base: string, order: number[] | null, size: number, complete: boolean): Promise<string> {
  const v = await loadStudioView(base, size);
  const { c, g } = canvas(v.w, v.h);
  paintStudio(v, complete ? null : new Set(order ?? []), g);
  return c.toDataURL('image/jpeg', 0.88);
}
