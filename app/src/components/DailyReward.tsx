import { useState } from 'react';
import { claimStreakReward, STREAK_REWARDS, usePlayer } from '../state/rewards';
import { rewardText } from './Celebrations';
import { feedback } from '../state/feedback';

export function DailyReward({ onClose }: { onClose(): void }) {
  const p = usePlayer();
  const today = (Math.max(1, p.streak) - 1) % 7;
  const [claimed, setClaimed] = useState(false);
  const claim = () => {
    claimStreakReward();
    feedback.complete();
    setClaimed(true);
    setTimeout(onClose, 1300);
  };
  return (
    <div className="modal-back">
      <div className="modal daily-modal" role="dialog" aria-modal>
        <div className={`gift ${claimed ? 'open' : ''}`}>🎁</div>
        <h3>{p.streak > 1 ? `${p.streak} giorni di fila!` : 'Bentornato!'}</h3>
        <p>Torna ogni giorno: i premi crescono fino al 7° giorno.</p>
        <div className="streak-days">
          {STREAK_REWARDS.map((r, i) => (
            <div key={i} className={`sday ${i < today ? 'past' : ''} ${i === today ? 'today' : ''} ${i === today && claimed ? 'got' : ''}`}>
              <small>G{i + 1}</small>
              <span>{r.hints && !r.coins ? '💡' : i === 6 ? '👑' : '🪙'}</span>
              <em>{r.coins ?? r.hints}</em>
            </div>
          ))}
        </div>
        {claimed
          ? <div className="claimed-text">{rewardText(STREAK_REWARDS[today])}</div>
          : <button className="btn btn-primary wide" onClick={claim}>Riscuoti {rewardText(STREAK_REWARDS[today])}</button>}
      </div>
    </div>
  );
}
