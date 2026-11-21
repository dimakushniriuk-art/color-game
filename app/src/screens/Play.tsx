import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogItem, Puzzle } from '../engine/types';
import { loadPuzzle } from '../data/catalog';
import { buy, events, getPlayer, levelInfo, SHOP, usePlayer } from '../state/rewards';
import { lastCompletion } from '../state/session';
import { Modal } from '../components/Modal';
import { PuzzleRenderer } from '../engine/renderer';
import { GameCanvas, type GameCanvasHandle } from '../components/GameCanvas';
import { getProgress, getSettings, saveProgress, updateSettings, useSettings } from '../state/store';
import { feedback } from '../state/feedback';
import { IconBack, IconBulb, IconCheck, IconExpand } from '../components/Icons';

const textOn = (rgb: [number, number, number]) => (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 150 ? '#1f2333' : '#ffffff');

interface PlayProps { item: CatalogItem; isDaily: boolean; onBack(): void; onComplete(): void; onChallenges(): void }

export function Play({ item, isDaily, onBack, onComplete, onChallenges }: PlayProps) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadPuzzle(item).then((p) => alive && setPuzzle(p)).catch((e) => alive && setError(String(e?.message ?? e)));
    return () => { alive = false; };
  }, [item]);

  if (error) return (
    <div className="center-msg">
      <p>Impossibile aprire il disegno.</p><small>{error}</small>
      <button className="btn btn-primary" onClick={onBack}>Torna indietro</button>
    </div>
  );
  if (!puzzle) return <div className="center-msg"><div className="spinner" /><p>Preparo il disegno…</p></div>;
  return <PlayBoard key={puzzle.id} item={item} isDaily={isDaily} puzzle={puzzle} onBack={onBack} onComplete={onComplete} onChallenges={onChallenges} />;
}

function PlayBoard({ item, isDaily, puzzle, onBack, onComplete, onChallenges }: PlayProps & { puzzle: Puzzle }) {
  const settings = useSettings();
  const player = usePlayer();
  const hintsUsed = useRef(getProgress(item.id)?.hintsUsed ?? 0);
  const [noHints, setNoHints] = useState(false);
  const [floats, setFloats] = useState<{ id: number; text: string }[]>([]);
  const [shake, setShake] = useState(0);
  const [pop, setPop] = useState(-1);
  const floatText = (text: string) => {
    const id = performance.now();
    setFloats((f) => [...f, { id, text }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1400);
  };
  const canvasRef = useRef<GameCanvasHandle>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const order = useRef<number[]>(getProgress(item.id)?.order.filter((r) => r < puzzle.regions.length) ?? []);
  const total = useMemo(() => puzzle.regions.filter((r) => r.area > 0).length, [puzzle]);

  const renderer = useMemo(() => {
    const r = new PuzzleRenderer(puzzle);
    r.setFilled(order.current);
    return r;
  }, [puzzle]);

  const countRemaining = () => puzzle.regionsByColor.map((list) => list.reduce((n, r) => n + (renderer.filled[r] ? 0 : 1), 0));
  const remRef = useRef<number[] | null>(null);
  if (!remRef.current) remRef.current = countRemaining();
  const remaining = remRef.current;
  const [selected, setSelected] = useState(() => Math.max(0, remaining.findIndex((n) => n > 0)));
  const finishedRef = useRef(false);
  const [filledCount, setFilledCount] = useState(order.current.length);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    renderer.highlight = settings.highlight;
    renderer.selected = selected;
    renderer.paintAll();
    canvasRef.current?.redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, settings.highlight]);

  const select = useCallback((c: number) => {
    setSelected(c);
    renderer.setSelected(c);
    canvasRef.current?.redraw();
    feedback.tap();
  }, [renderer]);

  useEffect(() => { if (pop < 0) return; const t = setTimeout(() => setPop(-1), 700); return () => clearTimeout(t); }, [pop]);

  // keep selected swatch visible
  useEffect(() => {
    paletteRef.current?.querySelector<HTMLElement>(`[data-c="${selected}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selected]);

  const persist = (completed: boolean) => saveProgress(item.id, { order: order.current, total, completed, updatedAt: Date.now(), hintsUsed: hintsUsed.current });

  const onTap = useCallback((ix: number, iy: number, tol: number) => {
    if (finished) return;
    const { width: w, height: h, idmap, regions } = puzzle;
    const x = Math.floor(ix), y = Math.floor(iy);
    const ok = (r: number) => r >= 0 && !renderer.filled[r] && regions[r].colorId === selected;
    let hit = x >= 0 && y >= 0 && x < w && y < h ? idmap[y * w + x] : -1;
    if (!ok(hit)) {
      // touch tolerance: nearest pixel of a matching region within the radius
      const rad = Math.ceil(tol);
      let best = -1, bd = Infinity;
      for (let dy = -rad; dy <= rad; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const d = dx * dx + dy * dy;
          if (d < bd && d <= rad * rad && ok(idmap[yy * w + xx])) { bd = d; best = idmap[yy * w + xx]; }
        }
      }
      if (best < 0) {
        if (hit >= 0 && !renderer.filled[hit]) { feedback.wrong(); canvasRef.current?.pulse(ix, iy, false); setShake((n) => n + 1); }
        return;
      }
      hit = best;
    }

    fillRegion(hit, ix, iy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, renderer, selected, finished]);

  function fillRegion(hit: number, ix?: number, iy?: number) {
    if (renderer.filled[hit] || finishedRef.current) return;
    const g = puzzle.regions[hit];
    renderer.markFilled(hit);
    canvasRef.current?.animateFill(hit, ix ?? g.labelX, iy ?? g.labelY);
    events.zone();
    order.current.push(hit);
    const c = puzzle.regions[hit].colorId;
    const rem = remRef.current!;
    rem[c]--;
    setFilledCount(order.current.length);
    canvasRef.current?.redraw();

    const allDone = order.current.length >= total;
    persist(allDone);
    if (allDone) {
      finishedRef.current = true;
      setFinished(true);
      feedback.complete();
      events.color();
      canvasRef.current?.celebrateColor(c);
      lastCompletion.levelBefore = levelInfo(getPlayer().xp).level;
      lastCompletion.reward = events.drawing({ hard: item.difficulty === 'difficile', daily: isDaily, hintsUsed: hintsUsed.current });
      lastCompletion.id = item.id;
      setTimeout(onComplete, 1300);
      return;
    }
    if (rem[c] === 0) {
      feedback.colorDone();
      events.color();
      canvasRef.current?.celebrateColor(c);
      setPop(c);
      floatText(`Colore ${puzzle.palette[c].number} completato · +2 🪙`);
      if (getSettings().autoNextColor) {
        const n = rem.length;
        for (let k = 1; k <= n; k++) { const nc = (c + k) % n; if (rem[nc] > 0) { select(nc); break; } }
      }
    } else feedback.fill();
  }

  // dev helper for testing: window.__cgFill(n) fills n regions
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__cgFill = (n: number) => {
      for (let r = 0; r < puzzle.regions.length && n > 0; r++) if (!renderer.filled[r] && puzzle.regions[r].area > 0) { fillRegion(r); n--; }
    };
  });

  const hint = () => {
    const left = puzzle.regionsByColor[selected]?.filter((r) => !renderer.filled[r]) ?? [];
    if (!left.length) return;
    if (!events.useHint()) { setNoHints(true); return; }
    hintsUsed.current++;
    persist(false);
    const r = left.reduce((a, b) => (puzzle.regions[b].area < puzzle.regions[a].area ? b : a));
    canvasRef.current?.focusOn(r);
    feedback.tap();
  };

  const pct = Math.floor((filledCount / Math.max(1, total)) * 100);

  return (
    <div className="play">
      <div className="play-top">
        <button className="icon-btn" onClick={onBack} aria-label="Indietro"><IconBack /></button>
        <div className="play-title">
          <span>{item.title}</span>
          <div className="play-progress"><div style={{ width: `${pct}%` }} /></div>
        </div>
        <span className="pct">{pct}%</span>
        <button className="icon-btn" onClick={() => canvasRef.current?.fit()} aria-label="Adatta"><IconExpand size={20} /></button>
        <button className="icon-btn hint" onClick={hint} aria-label="Suggerimento"><IconBulb size={22} /><span className="hint-count">{player.hints}</span></button>
      </div>

      <div className="play-stage">
        <div className="floats">{floats.map((f) => <div key={f.id} className="float-pill">{f.text}</div>)}</div>
        <GameCanvas ref={canvasRef} puzzle={puzzle} renderer={renderer} selected={selected} onTap={onTap} />
        {!settings.coachDone && (
          <div className="coach" onClick={() => updateSettings({ coachDone: true })}>
            <div className="coach-card">
              <b>Come si gioca</b>
              <ol>
                <li>Scegli un colore in basso</li>
                <li>Tocca le zone con lo stesso numero</li>
                <li>Allarga con due dita per vedere i numeri piccoli</li>
              </ol>
              <span className="btn btn-primary">Ho capito</span>
            </div>
          </div>
        )}
      </div>

      <div className="palette" ref={paletteRef}>
        {puzzle.palette.map((col) => {
          const tot = puzzle.regionsByColor[col.id].length;
          if (!tot) return null;
          const left = remaining[col.id];
          const done = left === 0;
          const frac = 1 - left / tot;
          return (
            <button
              key={col.id}
              data-c={col.id}
              className={`swatch ${col.id === selected ? 'sel' : ''} ${done ? 'done' : ''} ${col.id === selected && shake ? `shake${shake % 2}` : ''} ${pop === col.id ? 'pop' : ''}`}
              style={{ ['--c' as any]: col.hex, ['--t' as any]: textOn(col.rgb), ['--p' as any]: `${frac * 360}deg` }}
              onClick={() => !done && select(col.id)}
              aria-label={`Colore ${col.number}${done ? ' completato' : ''}`}
            >
              <span className="swatch-ring" />
              <span className="swatch-dot">{done ? <IconCheck size={18} /> : col.number}</span>
            </button>
          );
        })}
      </div>

      {noHints && (
        <Modal
          title="Suggerimenti finiti"
          text={player.coins >= SHOP[0].price ? `Puoi comprarne uno per ${SHOP[0].price} monete (ne hai ${player.coins}) oppure guadagnarli con le sfide.` : `Ti servono ${SHOP[0].price} monete (ne hai ${player.coins}). Completa le sfide per guadagnare suggerimenti e monete.`}
          confirmLabel={player.coins >= SHOP[0].price ? `Compra · ${SHOP[0].price} 🪙` : 'Vai alle sfide'}
          cancelLabel="Chiudi"
          onConfirm={() => { setNoHints(false); if (player.coins >= SHOP[0].price) { buy(SHOP[0]); } else onChallenges(); }}
          onCancel={() => setNoHints(false)}
        />
      )}
    </div>
  );
}
