import { useEffect, useRef, useState } from 'react';
import { levelInfo, usePlayer } from '../state/rewards';

/** Number that counts up/down smoothly when it changes. */
export function useAnimatedNumber(value: number, ms = 600) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value;
    if (a === b) return;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - k, 3);
      const v = Math.round(a + (b - a) * e);
      setShown(v); from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

function Bump({ value, children }: { value: number; children: React.ReactNode }) {
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current) { setBump(true); const t = setTimeout(() => setBump(false), 450); prev.current = value; return () => clearTimeout(t); }
    prev.current = value;
  }, [value]);
  return <span className={`wallet-chip ${bump ? 'bump' : ''}`}>{children}</span>;
}

export function Wallet({ onClick }: { onClick?(): void }) {
  const p = usePlayer();
  const coins = useAnimatedNumber(p.coins);
  const lv = levelInfo(p.xp);
  return (
    <button className="wallet" onClick={onClick} aria-label="Premi e sfide">
      <span className="wallet-chip level">
        <b>{lv.level}</b>
        <span className="lvl-bar"><span style={{ width: `${(lv.into / lv.need) * 100}%` }} /></span>
      </span>
      <Bump value={p.coins}>🪙 {coins}</Bump>
      <Bump value={p.hints}>💡 {p.hints}</Bump>
    </button>
  );
}
