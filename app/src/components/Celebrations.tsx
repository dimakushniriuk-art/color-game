import { useEffect, useState } from 'react';
import { onCelebrate, type Celebration, type Reward } from '../state/rewards';
import { feedback } from '../state/feedback';

export const rewardText = (r: Reward) =>
  [r.coins ? `+${r.coins} 🪙` : '', r.hints ? `+${r.hints} 💡` : '', r.xp ? `+${r.xp} XP` : ''].filter(Boolean).join('  ');

interface Item { id: number; c: Celebration }

/** Global overlay: trophy / challenge / level-up notifications, shown one at a time. */
export function Celebrations() {
  const [queue, setQueue] = useState<Item[]>([]);
  useEffect(() => onCelebrate((c) => setQueue((q) => [...q, { id: Math.random(), c }])), []);
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    if (current.c.kind === 'trophy' || current.c.kind === 'level') feedback.colorDone();
    const t = setTimeout(() => setQueue((q) => q.slice(1)), current.c.kind === 'level' ? 2600 : 2300);
    return () => clearTimeout(t);
  }, [current]);
  if (!current) return null;
  const { c } = current;
  const dismiss = () => setQueue((q) => q.slice(1));

  if (c.kind === 'level') {
    return (
      <div className="levelup" key={current.id} onClick={dismiss}>
        <div className="levelup-card">
          <div className="levelup-rays" />
          <div className="levelup-star">⭐</div>
          <small>Nuovo livello</small>
          <b>{c.level}</b>
        </div>
      </div>
    );
  }
  const [icon, title, sub] =
    c.kind === 'trophy' ? [c.trophy.icon, 'Trofeo sbloccato!', c.trophy.title]
      : c.kind === 'challenge' ? ['🎯', 'Sfida completata!', `${c.title} · riscuoti il premio`]
        : ['🎁', c.title, rewardText(c.reward)];
  return (
    <div className="celebration" key={current.id} onClick={dismiss}>
      <span className={`celebration-icon ${c.kind}`}>{icon}</span>
      <div><b>{title}</b><small>{sub}</small></div>
    </div>
  );
}
