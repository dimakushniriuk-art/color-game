import { useSyncExternalStore } from 'react';
import { mulberry32 } from '../engine/segment';

// Rewards, levels, streak, challenges and trophies. Stored locally (later: Supabase per account).

export interface Reward { coins?: number; hints?: number; xp?: number }

export interface Stats {
  zones: number;
  colors: number;
  drawings: number;
  hardDrawings: number;
  dailyDrawings: number;
  noHintDrawings: number;
  hintsUsed: number;
}

interface ChallengeState { key: string; progress: Record<string, number>; claimed: string[] }

export interface Player {
  coins: number;
  hints: number;
  xp: number;
  stats: Stats;
  streak: number;
  lastPlayDay: string;
  lastDailyClaim: string;
  daily: ChallengeState;
  weekly: ChallengeState;
  trophies: Record<string, number>;
}

export type Metric = keyof Stats;

export interface ChallengeDef { id: string; metric: Metric; target: number; title: string; reward: Reward }

export interface TrophyDef { id: string; icon: string; title: string; desc: string; metric: Metric | 'streak' | 'level'; target: number }

/* ---------- definitions ---------- */

export const TROPHIES: TrophyDef[] = [
  { id: 'first', icon: '🖼️', title: 'Primo capolavoro', desc: 'Completa il primo disegno', metric: 'drawings', target: 1 },
  { id: 'art5', icon: '🎨', title: 'Pittore', desc: 'Completa 5 disegni', metric: 'drawings', target: 5 },
  { id: 'art8', icon: '🏛️', title: 'Collezionista', desc: 'Completa 8 disegni', metric: 'drawings', target: 8 },
  { id: 'z500', icon: '🖌️', title: 'Pennello veloce', desc: 'Colora 500 zone', metric: 'zones', target: 500 },
  { id: 'z2000', icon: '⚡', title: 'Mano d\'oro', desc: 'Colora 2.000 zone', metric: 'zones', target: 2000 },
  { id: 'c50', icon: '🌈', title: 'Arcobaleno', desc: 'Completa 50 colori', metric: 'colors', target: 50 },
  { id: 'hard', icon: '🧩', title: 'Sfida accettata', desc: 'Completa un disegno difficile', metric: 'hardDrawings', target: 1 },
  { id: 'daily', icon: '☀️', title: 'Puntuale', desc: 'Completa un disegno del giorno', metric: 'dailyDrawings', target: 1 },
  { id: 'pure', icon: '💎', title: 'Occhio di falco', desc: 'Completa un disegno senza suggerimenti', metric: 'noHintDrawings', target: 1 },
  { id: 's3', icon: '🔥', title: 'In serie', desc: 'Gioca 3 giorni di fila', metric: 'streak', target: 3 },
  { id: 's7', icon: '🏆', title: 'Settimana perfetta', desc: 'Gioca 7 giorni di fila', metric: 'streak', target: 7 },
  { id: 'l5', icon: '⭐', title: 'Livello 5', desc: 'Raggiungi il livello 5', metric: 'level', target: 5 },
];
export const TROPHY_REWARD: Reward = { coins: 40, xp: 30 };

const DAILY_POOL: Omit<ChallengeDef, 'id'>[] = [
  { metric: 'zones', target: 100, title: 'Colora 100 zone', reward: { coins: 20, xp: 20 } },
  { metric: 'zones', target: 250, title: 'Colora 250 zone', reward: { coins: 40, xp: 40 } },
  { metric: 'colors', target: 5, title: 'Completa 5 colori', reward: { coins: 25, xp: 25 } },
  { metric: 'colors', target: 12, title: 'Completa 12 colori', reward: { coins: 40, hints: 1, xp: 40 } },
  { metric: 'drawings', target: 1, title: 'Completa un disegno', reward: { coins: 50, xp: 50 } },
  { metric: 'noHintDrawings', target: 1, title: 'Finisci un disegno senza suggerimenti', reward: { hints: 2, xp: 50 } },
  { metric: 'dailyDrawings', target: 1, title: 'Completa il disegno del giorno', reward: { coins: 60, xp: 60 } },
];
const WEEKLY_POOL: Omit<ChallengeDef, 'id'>[] = [
  { metric: 'drawings', target: 3, title: 'Completa 3 disegni questa settimana', reward: { coins: 150, hints: 3, xp: 150 } },
  { metric: 'zones', target: 1500, title: 'Colora 1.500 zone questa settimana', reward: { coins: 150, hints: 3, xp: 150 } },
  { metric: 'hardDrawings', target: 1, title: 'Completa un disegno difficile', reward: { coins: 120, hints: 2, xp: 120 } },
];

export const STREAK_REWARDS: Reward[] = [
  { coins: 20 }, { coins: 30 }, { hints: 1 }, { coins: 50 }, { coins: 60 }, { hints: 2 }, { coins: 100, hints: 3 },
];

export const SHOP = [
  { id: 'h1', hints: 1, price: 30 },
  { id: 'h5', hints: 5, price: 120 },
  { id: 'h12', hints: 12, price: 250 },
];

/* ---------- dates ---------- */

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
export const weekKey = (d = new Date()) => { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return 'W' + dayKey(m); };
const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17);

export function dailyChallenges(key = dayKey()): ChallengeDef[] {
  const rnd = mulberry32(seedOf(key));
  const pool = DAILY_POOL.map((c, i) => ({ c, i, r: rnd() })).sort((a, b) => a.r - b.r);
  const picked: typeof pool = [];
  for (const p of pool) { if (!picked.some((q) => q.c.metric === p.c.metric)) picked.push(p); if (picked.length === 3) break; }
  return picked.map((p) => ({ ...p.c, id: `d${p.i}` }));
}
export function weeklyChallenge(key = weekKey()): ChallengeDef {
  const i = seedOf(key) % WEEKLY_POOL.length;
  return { ...WEEKLY_POOL[i], id: `w${i}` };
}

/* ---------- levels ---------- */

export const xpForLevel = (l: number) => 80 + l * 40;
export function levelInfo(xp: number) {
  let level = 1, rest = xp;
  while (rest >= xpForLevel(level)) { rest -= xpForLevel(level); level++; }
  return { level, into: rest, need: xpForLevel(level) };
}

/* ---------- store ---------- */

const KEY = 'cg.player';
const fresh = (): Player => ({
  coins: 50, hints: 5, xp: 0,
  stats: { zones: 0, colors: 0, drawings: 0, hardDrawings: 0, dailyDrawings: 0, noHintDrawings: 0, hintsUsed: 0 },
  streak: 0, lastPlayDay: '', lastDailyClaim: '',
  daily: { key: dayKey(), progress: {}, claimed: [] },
  weekly: { key: weekKey(), progress: {}, claimed: [] },
  trophies: {},
});

function load(): Player {
  try {
    const v = localStorage.getItem(KEY);
    if (!v) return fresh();
    const p = JSON.parse(v);
    const f = fresh();
    return { ...f, ...p, stats: { ...f.stats, ...p.stats } };
  } catch { return fresh(); }
}

let player = load();
const listeners = new Set<() => void>();
const commit = (p: Player) => {
  player = p;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
};
export const usePlayer = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => player);
export const getPlayer = () => player;

/* ---------- celebrations bus (toasts / popups) ---------- */

export type Celebration =
  | { kind: 'trophy'; trophy: TrophyDef }
  | { kind: 'challenge'; title: string }
  | { kind: 'level'; level: number }
  | { kind: 'reward'; reward: Reward; title: string };
type CelebListener = (c: Celebration) => void;
const celebListeners = new Set<CelebListener>();
export const onCelebrate = (l: CelebListener) => { celebListeners.add(l); return () => { celebListeners.delete(l); }; };
const celebrate = (c: Celebration) => celebListeners.forEach((l) => l(c));

/* ---------- logic ---------- */

function rollover(p: Player): Player {
  const dk = dayKey(), wk = weekKey();
  let q = p;
  if (q.daily.key !== dk) q = { ...q, daily: { key: dk, progress: {}, claimed: [] } };
  if (q.weekly.key !== wk) q = { ...q, weekly: { key: wk, progress: {}, claimed: [] } };
  return q;
}

function addReward(p: Player, r: Reward): Player {
  const before = levelInfo(p.xp).level;
  const q = { ...p, coins: p.coins + (r.coins ?? 0), hints: p.hints + (r.hints ?? 0), xp: p.xp + (r.xp ?? 0) };
  const after = levelInfo(q.xp).level;
  if (after > before) setTimeout(() => celebrate({ kind: 'level', level: after }), 50);
  return q;
}

function trophyValue(p: Player, t: TrophyDef) {
  if (t.metric === 'streak') return p.streak;
  if (t.metric === 'level') return levelInfo(p.xp).level;
  return p.stats[t.metric];
}
export const trophyProgress = (t: TrophyDef) => Math.min(t.target, trophyValue(player, t));

function checkTrophies(p: Player): Player {
  let q = p;
  for (const t of TROPHIES) {
    if (q.trophies[t.id] || trophyValue(q, t) < t.target) continue;
    q = addReward({ ...q, trophies: { ...q.trophies, [t.id]: Date.now() } }, TROPHY_REWARD);
    const tt = t;
    setTimeout(() => celebrate({ kind: 'trophy', trophy: tt }), 300);
  }
  return q;
}

function track(p: Player, metric: Metric, n: number): Player {
  const before = (c: ChallengeDef, s: ChallengeState) => (s.progress[c.metric] ?? 0) >= c.target;
  const q0 = rollover(p);
  const daily = dailyChallenges(q0.daily.key), weekly = weeklyChallenge(q0.weekly.key);
  const wasDone = [...daily.map((c) => before(c, q0.daily)), before(weekly, q0.weekly)];
  const q: Player = {
    ...q0,
    stats: { ...q0.stats, [metric]: q0.stats[metric] + n },
    daily: { ...q0.daily, progress: { ...q0.daily.progress, [metric]: (q0.daily.progress[metric] ?? 0) + n } },
    weekly: { ...q0.weekly, progress: { ...q0.weekly.progress, [metric]: (q0.weekly.progress[metric] ?? 0) + n } },
  };
  [...daily, weekly].forEach((c, i) => {
    const s = i < daily.length ? q.daily : q.weekly;
    if (!wasDone[i] && before(c, s)) setTimeout(() => celebrate({ kind: 'challenge', title: c.title }), 200);
  });
  return q;
}

/** Call on app start: updates the streak. Returns true if today's streak reward is available. */
export function registerVisit(): boolean {
  const today = dayKey();
  let p = rollover(player);
  if (p.lastPlayDay !== today) {
    const streak = p.lastPlayDay === yesterdayKey() ? p.streak + 1 : 1;
    p = checkTrophies({ ...p, streak, lastPlayDay: today });
  }
  commit(p);
  return p.lastDailyClaim !== today;
}

export const streakRewardFor = (streak: number) => STREAK_REWARDS[(Math.max(1, streak) - 1) % 7];

export function claimStreakReward(): Reward {
  const r = streakRewardFor(player.streak);
  commit({ ...addReward(player, r), lastDailyClaim: dayKey() });
  return r;
}

export const events = {
  zone() { commit(checkTrophies(addReward(track(player, 'zones', 1), { xp: 1 }))); },
  color() { commit(checkTrophies(addReward(track(player, 'colors', 1), { coins: 2, xp: 5 }))); },
  /** returns the reward given for the drawing, shown on the completion screen */
  drawing(opts: { hard: boolean; daily: boolean; hintsUsed: number }): Reward {
    const r: Reward = { coins: 25 + (opts.hard ? 25 : 0), xp: 50 + (opts.hard ? 50 : 0) };
    if (opts.daily) { r.coins! *= 2; r.xp! *= 2; }
    if (opts.hintsUsed === 0) r.coins! += 10;
    let p = track(player, 'drawings', 1);
    if (opts.hard) p = track(p, 'hardDrawings', 1);
    if (opts.daily) p = track(p, 'dailyDrawings', 1);
    if (opts.hintsUsed === 0) p = track(p, 'noHintDrawings', 1);
    commit(checkTrophies(addReward(p, r)));
    return r;
  },
  /** spends one hint; false if none left */
  useHint(): boolean {
    if (player.hints <= 0) return false;
    commit(track({ ...player, hints: player.hints - 1 }, 'hintsUsed', 1));
    return true;
  },
};

export function claimChallenge(c: ChallengeDef, weekly: boolean) {
  const p = rollover(player);
  const s = weekly ? p.weekly : p.daily;
  if (s.claimed.includes(c.id) || (s.progress[c.metric] ?? 0) < c.target) return;
  const ns = { ...s, claimed: [...s.claimed, c.id] };
  commit(checkTrophies(addReward({ ...p, [weekly ? 'weekly' : 'daily']: ns }, c.reward)));
  celebrate({ kind: 'reward', reward: c.reward, title: 'Sfida completata' });
}

export function buy(item: (typeof SHOP)[number]): boolean {
  if (player.coins < item.price) return false;
  commit({ ...player, coins: player.coins - item.price, hints: player.hints + item.hints });
  celebrate({ kind: 'reward', reward: { hints: item.hints }, title: 'Acquisto fatto' });
  return true;
}

export function challengeProgress(c: ChallengeDef, weekly: boolean) {
  const s = weekly ? player.weekly : player.daily;
  const key = weekly ? weekKey() : dayKey();
  const valid = s.key === key;
  return {
    value: valid ? Math.min(c.target, s.progress[c.metric] ?? 0) : 0,
    claimed: valid && s.claimed.includes(c.id),
  };
}

export function resetPlayer() { commit(fresh()); }
