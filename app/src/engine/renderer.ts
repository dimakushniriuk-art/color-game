import type { Puzzle } from './types';

const pack = (r: number, g: number, b: number) => (0xff << 24) | (b << 16) | (g << 8) | r; // little-endian RGBA

const WHITE = pack(255, 255, 255);
const LINE = pack(92, 92, 100);
const CHECK_A = pack(196, 198, 206);
const CHECK_B = pack(232, 233, 238);

/** Holds the full-resolution picture and repaints only what changes. */
export class PuzzleRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  private buf: Uint32Array;
  readonly filled: Uint8Array;
  private colorPx: Uint32Array;
  private linePx: Uint32Array;
  private checker: number;
  private dirty: [number, number, number, number] | null = null;
  selected = -1;
  highlight = true;
  showLines = true;

  constructor(readonly p: Puzzle) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = p.width; this.canvas.height = p.height;
    this.ctx = this.canvas.getContext('2d')!;
    this.img = this.ctx.createImageData(p.width, p.height);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.filled = new Uint8Array(p.regions.length);
    this.colorPx = new Uint32Array(p.palette.map((c) => pack(c.rgb[0], c.rgb[1], c.rgb[2])));
    this.linePx = new Uint32Array(p.palette.map((c) => pack(c.rgb[0] * 0.55, c.rgb[1] * 0.55, c.rgb[2] * 0.55)));
    this.checker = Math.max(2, Math.round(Math.max(p.width, p.height) / 220));
  }

  /** reveal radius for the fill animation (-1 = none) */
  private reveal: { r: number; cx: number; cy: number; rad2: number } | null = null;

  private paintRegion(r: number) {
    const { p, buf } = this;
    const reg = p.regions[r];
    const rv = this.reveal && this.reveal.r === r ? this.reveal : null;
    let filled = this.filled[r] === 1;
    const sel = this.highlight && reg.colorId === this.selected;
    const fillC = this.colorPx[reg.colorId], lineC = this.linePx[reg.colorId];
    const w = p.width, ck = this.checker, lines = p.lines, showLines = this.showLines;
    for (let k = p.pixStart[r], e = p.pixStart[r + 1]; k < e; k++) {
      const i = p.pixIdx[k];
      if (rv) {
        const dx = (i % w) - rv.cx, dy = ((i / w) | 0) - rv.cy;
        filled = dx * dx + dy * dy <= rv.rad2;
      }
      if (showLines && lines[i]) { buf[i] = filled ? lineC : LINE; continue; }
      if (filled) buf[i] = fillC;
      else if (sel) {
        const x = i % w, y = (i / w) | 0;
        buf[i] = (((x / ck) | 0) + ((y / ck) | 0)) & 1 ? CHECK_A : CHECK_B;
      } else buf[i] = WHITE;
    }
    const [x0, y0, x1, y1] = reg.bbox;
    if (!this.dirty) this.dirty = [x0, y0, x1, y1];
    else {
      const d = this.dirty;
      d[0] = Math.min(d[0], x0); d[1] = Math.min(d[1], y0); d[2] = Math.max(d[2], x1); d[3] = Math.max(d[3], y1);
    }
  }

  paintAll() {
    this.buf.fill(0);
    for (let i = 0; i < this.p.idmap.length; i++) if (this.p.idmap[i] < 0) this.buf[i] = this.showLines ? WHITE : 0;
    for (let r = 0; r < this.p.regions.length; r++) this.paintRegion(r);
    this.dirty = [0, 0, this.p.width - 1, this.p.height - 1];
    this.flush();
  }

  setFilled(order: number[]) {
    this.filled.fill(0);
    for (const r of order) this.filled[r] = 1;
  }

  /** marks a region filled without painting it (the canvas animates it with paintReveal) */
  markFilled(r: number) { this.filled[r] = 1; }

  /** paints region r filled only inside a circle (fill animation frame) */
  paintReveal(r: number, cx: number, cy: number, rad: number) {
    this.reveal = { r, cx, cy, rad2: rad * rad };
    this.paintRegion(r);
    this.reveal = null;
    this.flush();
  }

  repaint(r: number) { this.paintRegion(r); this.flush(); }

  fill(r: number) {
    this.filled[r] = 1;
    this.paintRegion(r);
    this.flush();
  }

  setSelected(colorId: number) {
    const old = this.selected;
    this.selected = colorId;
    for (const c of [old, colorId]) {
      if (c < 0) continue;
      for (const r of this.p.regionsByColor[c]) if (!this.filled[r]) this.paintRegion(r);
    }
    this.flush();
  }

  flush() {
    if (!this.dirty) return;
    const [x0, y0, x1, y1] = this.dirty;
    this.ctx.putImageData(this.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    this.dirty = null;
  }
}

/** Small preview: filled regions in colour, the rest as line art. */
export function renderThumbnail(p: Puzzle, order: number[] | null, size: number, complete = false): string {
  const r = new PuzzleRenderer(p);
  r.highlight = false;
  if (complete) { r.showLines = false; r.filled.fill(1); } else if (order) r.setFilled(order);
  r.paintAll();
  const c = document.createElement('canvas');
  const s = size / Math.max(p.width, p.height);
  c.width = Math.round(p.width * s); c.height = Math.round(p.height * s);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(r.canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
