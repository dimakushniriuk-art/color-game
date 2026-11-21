import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { CatalogItem, Puzzle } from '../engine/types';
import { loadPuzzle } from '../data/catalog';
import { PuzzleRenderer } from '../engine/renderer';
import { getProgress } from '../state/store';
import { IconReplay, IconShare } from '../components/Icons';
import { lastCompletion } from '../state/session';
import { levelInfo, usePlayer, type Reward } from '../state/rewards';
import { useAnimatedNumber } from '../components/Wallet';

function RewardSummary({ reward, levelBefore }: { reward: Reward; levelBefore: number }) {
  const p = usePlayer();
  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), 500); return () => clearTimeout(t); }, []);
  const coins = useAnimatedNumber(go ? reward.coins ?? 0 : 0, 900);
  const xp = useAnimatedNumber(go ? reward.xp ?? 0 : 0, 900);
  const lv = levelInfo(p.xp);
  return (
    <div className="reward-summary">
      <div className="reward-row">
        <div className="reward-pill"><span>🪙</span><b>+{coins}</b></div>
        <div className="reward-pill"><span>✨</span><b>+{xp} XP</b></div>
      </div>
      <div className="reward-level">
        <span>Livello {lv.level}{lv.level > levelBefore && <em> · nuovo!</em>}</span>
        <div className="level-bar"><div style={{ width: go ? `${(lv.into / lv.need) * 100}%` : '0%' }} /></div>
      </div>
    </div>
  );
}

const REPLAY_MS = 4500;

export function Complete({ item, next, onGallery, onNext }: { item: CatalogItem; next: CatalogItem | null; onGallery(): void; onNext(): void }) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PuzzleRenderer | null>(null);
  const raf = useRef(0);
  const [summary] = useState(() => (lastCompletion.id === item.id && lastCompletion.reward ? { reward: lastCompletion.reward, levelBefore: lastCompletion.levelBefore } : null));
  useEffect(() => () => { if (lastCompletion.id === item.id) lastCompletion.id = null; }, [item.id]);

  useEffect(() => { loadPuzzle(item).then(setPuzzle); }, [item]);

  const paint = () => {
    const cv = canvasRef.current, r = rendererRef.current;
    if (!cv || !r) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(r.canvas, 0, 0, cv.width, cv.height);
  };

  const showFinal = () => {
    const r = rendererRef.current!;
    r.showLines = false; r.highlight = false; r.filled.fill(1); r.paintAll(); paint();
  };

  const replay = () => {
    const p = puzzle!, r = rendererRef.current!;
    cancelAnimationFrame(raf.current);
    const order = getProgress(item.id)?.order ?? p.regions.map((g) => g.index);
    r.showLines = true; r.highlight = false; r.filled.fill(0); r.paintAll(); paint();
    const t0 = performance.now();
    let i = 0;
    const step = (now: number) => {
      const target = Math.min(order.length, Math.ceil(((now - t0) / REPLAY_MS) * order.length));
      for (; i < target; i++) r.fill(order[i]);
      paint();
      if (i < order.length) raf.current = requestAnimationFrame(step);
      else setTimeout(showFinal, 300);
    };
    raf.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!puzzle) return;
    const cv = canvasRef.current!;
    const scale = Math.min(2, 1200 / Math.max(puzzle.width, puzzle.height)) || 1;
    cv.width = Math.round(puzzle.width * scale); cv.height = Math.round(puzzle.height * scale);
    rendererRef.current = new PuzzleRenderer(puzzle);
    replay();
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle]);

  const share = async () => {
    cancelAnimationFrame(raf.current);
    showFinal();
    const cv = canvasRef.current!;
    const name = `color-game-${item.id}.png`;
    try {
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const data = cv.toDataURL('image/png').split(',')[1];
        const f = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
        await Share.share({ title: item.title, files: [f.uri] });
        return;
      }
      const blob: Blob = await new Promise((res) => cv.toBlob((b) => res(b!), 'image/png'));
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: item.title }); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setMsg('Immagine salvata');
    } catch (e: any) {
      if (e?.name !== 'AbortError') setMsg('Condivisione non riuscita');
    }
    setTimeout(() => setMsg(null), 2200);
  };

  return (
    <div className="complete">
      <div className="confetti" aria-hidden>{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ ['--i' as any]: i, ['--x' as any]: `${(i * 37) % 100}%`, ['--d' as any]: `${(i % 7) * 0.12}s` }} />)}</div>
      <h1 className="complete-title">Bellissimo!</h1>
      <p className="complete-sub">Hai completato «{item.title}»</p>
      <div className="complete-frame"><canvas ref={canvasRef} /></div>
      {summary && <RewardSummary reward={summary.reward} levelBefore={summary.levelBefore} />}
      <div className="complete-actions">
        <button className="btn btn-ghost" onClick={replay} disabled={!puzzle}><IconReplay size={18} /> Rivedi</button>
        <button className="btn btn-ghost" onClick={share} disabled={!puzzle}><IconShare size={18} /> Salva</button>
      </div>
      <div className="complete-actions">
        {next && <button className="btn btn-primary wide" onClick={onNext}>Prossimo disegno</button>}
        <button className="btn btn-soft wide" onClick={onGallery}>Galleria</button>
      </div>
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
