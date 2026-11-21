import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Puzzle } from '../engine/types';
import type { PuzzleRenderer } from '../engine/renderer';

export interface GameCanvasHandle {
  redraw(): void;
  focusOn(region: number): void;
  pulse(x: number, y: number, ok: boolean): void;
  fit(): void;
  /** fill animation (radial reveal) + sparkles from the tap point */
  animateFill(region: number, x: number, y: number): void;
  /** big sparkle burst at the centre of every region of a colour */
  celebrateColor(colorId: number): void;
}

interface Props {
  puzzle: Puzzle;
  renderer: PuzzleRenderer;
  selected: number;
  onTap(imgX: number, imgY: number, tolerance: number): void;
}

interface Cam { s: number; tx: number; ty: number }
interface Fx { x: number; y: number; t0: number; ok: boolean }
interface FillAnim { r: number; x: number; y: number; t0: number; maxR: number }
interface Particle { x: number; y: number; vx: number; vy: number; t0: number; life: number; color: string; size: number }
const FILL_MS = 260;

const TAP_SLOP = 8;
const MIN_LABEL_PX = 9;

export const GameCanvas = forwardRef<GameCanvasHandle, Props>(function GameCanvas({ puzzle, renderer, selected, onTap }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cam = useRef<Cam>({ s: 1, tx: 0, ty: 0 });
  const size = useRef({ w: 1, h: 1, dpr: 1 });
  const fitScale = useRef(1);
  const frame = useRef(0);
  const fx = useRef<Fx[]>([]);
  const fills = useRef<FillAnim[]>([]);
  const parts = useRef<Particle[]>([]);
  const anim = useRef<{ from: Cam; to: Cam; t0: number; dur: number } | null>(null);
  const selRef = useRef(selected);
  selRef.current = selected;
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  const request = () => { if (!frame.current) frame.current = requestAnimationFrame(draw); };

  const clamp = (c: Cam): Cam => {
    const { w, h } = size.current;
    const minS = fitScale.current * 0.8, maxS = Math.max(fitScale.current * 10, 4);
    const s = Math.min(maxS, Math.max(minS, c.s));
    const iw = puzzle.width * s, ih = puzzle.height * s, m = 60;
    const tx = iw + 2 * m < w ? (w - iw) / 2 : Math.min(m, Math.max(w - iw - m, c.tx));
    const ty = ih + 2 * m < h ? (h - ih) / 2 : Math.min(m, Math.max(h - ih - m, c.ty));
    return { s, tx, ty };
  };

  function draw(now: number) {
    frame.current = 0;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const { w, h, dpr } = size.current;

    if (anim.current) {
      const a = anim.current;
      const k = Math.min(1, (now - a.t0) / a.dur), e = 1 - Math.pow(1 - k, 3);
      // interpolate in log-scale for a natural zoom
      const s = Math.exp(Math.log(a.from.s) + (Math.log(a.to.s) - Math.log(a.from.s)) * e);
      cam.current = { s, tx: a.from.tx + (a.to.tx - a.from.tx) * e, ty: a.from.ty + (a.to.ty - a.from.ty) * e };
      if (k >= 1) anim.current = null; else request();
    }
    const { s, tx, ty } = cam.current;

    // fill animations: grow the coloured circle inside the region
    if (fills.current.length) {
      const live: FillAnim[] = [];
      for (const f of fills.current) {
        const k = Math.min(1, (now - f.t0) / FILL_MS);
        if (k >= 1) renderer.repaint(f.r);
        else { renderer.paintReveal(f.r, f.x, f.y, f.maxR * (1 - Math.pow(1 - k, 2))); live.push(f); }
      }
      fills.current = live;
      if (live.length) request();
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(s, s);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 16 / s;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, puzzle.width, puzzle.height);
    ctx.shadowBlur = 0;
    ctx.drawImage(renderer.canvas, 0, 0);
    ctx.restore();

    // numbers in screen space (crisp at any zoom)
    const x0 = -tx / s, y0 = -ty / s, x1 = (w - tx) / s, y1 = (h - ty) / s;
    const sel = selRef.current;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const regs = puzzle.regions, filled = renderer.filled;
    let lastFont = '';
    for (let r = 0; r < regs.length; r++) {
      if (filled[r]) continue;
      const g = regs[r];
      const px = g.labelSize * s;
      if (px < MIN_LABEL_PX) continue;
      if (g.labelX < x0 || g.labelX > x1 || g.labelY < y0 || g.labelY > y1) continue;
      const fs = Math.min(px, 26);
      const isSel = g.colorId === sel;
      const font = `${isSel ? 700 : 500} ${fs.toFixed(0)}px system-ui, -apple-system, sans-serif`;
      if (font !== lastFont) { ctx.font = font; lastFont = font; }
      ctx.fillStyle = isSel ? '#1f2333' : '#9a9caa';
      ctx.fillText(String(puzzle.palette[g.colorId].number), g.labelX * s + tx, g.labelY * s + ty + fs * 0.04);
    }

    // tap effects
    const live: Fx[] = [];
    for (const f of fx.current) {
      const k = (now - f.t0) / 350;
      if (k >= 1) continue;
      live.push(f);
      if (k < 0) continue;
      ctx.beginPath();
      ctx.arc(f.x * s + tx, f.y * s + ty, 10 + k * 26, 0, Math.PI * 2);
      ctx.strokeStyle = f.ok ? `rgba(255,122,89,${0.9 * (1 - k)})` : `rgba(239,71,111,${0.8 * (1 - k)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    fx.current = live;
    if (live.length) request();

    // sparkles (screen space)
    if (parts.current.length) {
      const alive: Particle[] = [];
      for (const q of parts.current) {
        const t = (now - q.t0) / 1000;
        if (t > q.life) continue;
        alive.push(q);
        if (t < 0) continue;
        const k = t / q.life;
        const px = q.x * s + tx + q.vx * t, py = q.y * s + ty + q.vy * t + 300 * t * t;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.arc(px, py, q.size * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      parts.current = alive;
      if (alive.length) request();
    }
  }

  const spawn = (x: number, y: number, color: string, n: number, speed: number, delay = 0) => {
    const t0 = performance.now() + delay;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      parts.current.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, t0, life: 0.45 + Math.random() * 0.35, color: Math.random() < 0.3 ? '#ffffff' : color, size: 2 + Math.random() * 3 });
    }
  };

  const animateTo = (to: Cam, dur = 450) => {
    anim.current = { from: { ...cam.current }, to: clamp(to), t0: performance.now(), dur };
    request();
  };

  const fit = (animate = false) => {
    const { w, h } = size.current;
    const s = Math.min(w / puzzle.width, h / puzzle.height) * 0.94;
    fitScale.current = s;
    const target = { s, tx: (w - puzzle.width * s) / 2, ty: (h - puzzle.height * s) / 2 };
    if (animate) animateTo(target); else { cam.current = target; request(); }
  };

  useImperativeHandle(ref, () => ({
    redraw: request,
    fit: () => fit(true),
    focusOn(region) {
      const g = puzzle.regions[region];
      const { w, h } = size.current;
      const s = Math.min(fitScale.current * 6, Math.max(cam.current.s, 28 / Math.max(1, g.labelSize)));
      animateTo({ s, tx: w / 2 - g.labelX * s, ty: h / 2 - g.labelY * s }, 600);
      fx.current.push({ x: g.labelX, y: g.labelY, t0: performance.now() + 500, ok: true });
    },
    animateFill(region, x, y) {
      const [x0, y0, x1, y1] = puzzle.regions[region].bbox;
      const maxR = Math.hypot(Math.max(x - x0, x1 - x), Math.max(y - y0, y1 - y)) + 1;
      fills.current.push({ r: region, x, y, t0: performance.now(), maxR });
      spawn(x, y, puzzle.palette[puzzle.regions[region].colorId].hex, 9, 140);
      request();
    },
    celebrateColor(colorId) {
      const list = puzzle.regionsByColor[colorId];
      const hex = puzzle.palette[colorId].hex;
      const step = Math.max(1, Math.floor(list.length / 25));
      list.forEach((r, i) => { if (i % step === 0) spawn(puzzle.regions[r].labelX, puzzle.regions[r].labelY, hex, 6, 120, (i / step) * 25); });
      request();
    },
    pulse(x, y, ok) { fx.current.push({ x, y, t0: performance.now(), ok }); request(); },
  }));

  // resize
  useEffect(() => {
    const cv = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const first = size.current.w <= 1;
      size.current = { w: rect.width, h: rect.height, dpr };
      cv.width = Math.round(rect.width * dpr); cv.height = Math.round(rect.height * dpr);
      if (first) fit(); else { fitScale.current = Math.min(rect.width / puzzle.width, rect.height / puzzle.height) * 0.94; cam.current = clamp(cam.current); request(); }
    });
    ro.observe(cv);
    return () => { ro.disconnect(); cancelAnimationFrame(frame.current); frame.current = 0; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle]);

  useEffect(request, [selected]);

  // gestures: 1 finger pan / tap, 2 fingers pinch, wheel zoom, double tap zoom
  useEffect(() => {
    const cv = canvasRef.current!;
    const pts = new Map<number, { x: number; y: number }>();
    let downAt = { x: 0, y: 0, t: 0 }, moved = false, pinch: { d: number; mx: number; my: number } | null = null;
    let lastTap = { t: 0, x: 0, y: 0 };
    const local = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const zoomAt = (mx: number, my: number, factor: number) => {
      const c = cam.current, s = c.s * factor;
      cam.current = clamp({ s, tx: mx - (mx - c.tx) * (s / c.s), ty: my - (my - c.ty) * (s / c.s) });
      request();
    };
    const pinchInfo = () => {
      const [a, b] = [...pts.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };

    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      anim.current = null;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pts.size === 1) { downAt = { ...p, t: performance.now() }; moved = false; }
      if (pts.size === 2) { pinch = pinchInfo(); moved = true; }
    };
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pts.size >= 2 && pinch) {
        const n = pinchInfo();
        const c = cam.current;
        const s = c.s * (n.d / pinch.d);
        cam.current = clamp({ s, tx: n.mx - (pinch.mx - c.tx) * (s / c.s), ty: n.my - (pinch.my - c.ty) * (s / c.s) });
        pinch = n;
        request();
      } else if (pts.size === 1) {
        if (!moved && Math.hypot(p.x - downAt.x, p.y - downAt.y) > TAP_SLOP) moved = true;
        if (moved) {
          cam.current = clamp({ ...cam.current, tx: cam.current.tx + p.x - prev.x, ty: cam.current.ty + p.y - prev.y });
          request();
        }
      }
    };
    const up = (e: PointerEvent) => {
      const had = pts.has(e.pointerId);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (!had || moved || pts.size > 0) return;
      const p = local(e), c = cam.current, now = performance.now();
      if (now - lastTap.t < 280 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 24 && c.s < fitScale.current * 2) {
        // double tap on a zoomed-out picture: zoom in
        const s = c.s * 3;
        animateTo({ s, tx: p.x - (p.x - c.tx) * 3, ty: p.y - (p.y - c.ty) * 3 }, 300);
        lastTap.t = 0;
        return;
      }
      lastTap = { t: now, x: p.x, y: p.y };
      tapRef.current((p.x - c.tx) / c.s, (p.y - c.ty) / c.s, 14 / c.s);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', wheel, { passive: false });
    return () => {
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      cv.removeEventListener('wheel', wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle]);

  return <canvas ref={canvasRef} className="game-canvas" />;
});
