import { useEffect, useState } from 'react';
import {
  buy, challengeProgress, claimChallenge, dailyChallenges, levelInfo, SHOP, STREAK_REWARDS, TROPHIES, trophyProgress, usePlayer,
  weeklyChallenge, type ChallengeDef,
} from '../state/rewards';
import { Wallet } from '../components/Wallet';
import { rewardText } from '../components/Celebrations';

function useCountdown(weekly: boolean) {
  const calc = () => {
    const now = new Date(), end = new Date(now);
    end.setHours(24, 0, 0, 0);
    if (weekly) end.setDate(end.getDate() + ((7 - now.getDay()) % 7));
    const m = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60000));
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return d > 0 ? `${d}g ${h}h` : `${h}h ${m % 60}m`;
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const i = setInterval(() => setT(calc()), 30000); return () => clearInterval(i); });
  return t;
}

function ChallengeCard({ c, weekly }: { c: ChallengeDef; weekly?: boolean }) {
  usePlayer();
  const { value, claimed } = challengeProgress(c, !!weekly);
  const done = value >= c.target;
  return (
    <div className={`challenge ${weekly ? 'weekly' : ''} ${done && !claimed ? 'ready' : ''} ${claimed ? 'claimed' : ''}`}>
      <div className="challenge-main">
        <b>{c.title}</b>
        <div className="challenge-bar"><div style={{ width: `${(value / c.target) * 100}%` }} /></div>
        <small>{value} / {c.target} · {rewardText(c.reward)}</small>
      </div>
      {claimed ? <span className="challenge-done">✓</span>
        : <button className="btn btn-primary btn-sm" disabled={!done} onClick={() => claimChallenge(c, !!weekly)}>{done ? 'Riscuoti' : `${Math.floor((value / c.target) * 100)}%`}</button>}
    </div>
  );
}

export function Challenges() {
  const p = usePlayer();
  const lv = levelInfo(p.xp);
  const dayLeft = useCountdown(false), weekLeft = useCountdown(true);
  const streakIdx = (Math.max(1, p.streak) - 1) % 7;
  const unlocked = Object.keys(p.trophies).length;

  return (
    <div className="screen-scroll">
      <header className="page-head row-head"><h1>Sfide</h1><Wallet /></header>

      <div className="level-card">
        <div className="level-badge">{lv.level}</div>
        <div className="level-info">
          <b>Livello {lv.level}</b>
          <div className="level-bar"><div style={{ width: `${(lv.into / lv.need) * 100}%` }} /></div>
          <small>{lv.into} / {lv.need} XP al prossimo livello</small>
        </div>
      </div>

      <div className="streak-card">
        <div className="flame">🔥</div>
        <div className="streak-info">
          <b>{p.streak} {p.streak === 1 ? 'giorno' : 'giorni'} di fila</b>
          <div className="streak-dots">{STREAK_REWARDS.map((_, i) => <i key={i} className={i <= streakIdx ? 'on' : ''} />)}</div>
        </div>
      </div>

      <div className="section-row"><div className="section-title">Sfide di oggi</div><span className="timer">⏱ {dayLeft}</span></div>
      <div className="challenges">{dailyChallenges().map((c) => <ChallengeCard key={c.id} c={c} />)}</div>

      <div className="section-row"><div className="section-title">Sfida della settimana</div><span className="timer">⏱ {weekLeft}</span></div>
      <ChallengeCard c={weeklyChallenge()} weekly />

      <div className="section-row"><div className="section-title">Negozio</div></div>
      <div className="shop">
        {SHOP.map((it) => (
          <button key={it.id} className="shop-item" disabled={p.coins < it.price} onClick={() => buy(it)}>
            <span className="shop-icon">💡</span>
            <b>{it.hints} {it.hints === 1 ? 'suggerimento' : 'suggerimenti'}</b>
            <span className="price">🪙 {it.price}</span>
          </button>
        ))}
      </div>

      <div className="section-row"><div className="section-title">Trofei</div><span className="timer">{unlocked}/{TROPHIES.length}</span></div>
      <div className="trophies">
        {TROPHIES.map((t) => {
          const got = !!p.trophies[t.id];
          const prog = trophyProgress(t);
          return (
            <div key={t.id} className={`trophy ${got ? 'got' : ''}`}>
              <div className="trophy-icon">{t.icon}</div>
              <b>{t.title}</b>
              <small>{got ? t.desc : `${prog}/${t.target}`}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}
