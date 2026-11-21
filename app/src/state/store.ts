import { useSyncExternalStore } from 'react';

// Local persistence (localStorage works in browser, PWA and inside Capacitor's WebView).
// Later: sync to Supabase when user accounts are added.

export interface Settings {
  haptics: boolean;
  sound: boolean;
  theme: 'system' | 'light' | 'dark';
  highlight: boolean;
  autoNextColor: boolean;
  onboardingDone: boolean;
  coachDone: boolean;
}

export interface Progress {
  /** region indices in the order they were filled (for the time-lapse) */
  order: number[];
  total: number;
  completed: boolean;
  updatedAt: number;
  hintsUsed?: number;
}

const DEFAULT_SETTINGS: Settings = {
  haptics: true, sound: true, theme: 'system', highlight: true, autoNextColor: true, onboardingDone: false, coachDone: false,
};

const K_SETTINGS = 'cg.settings';
const K_PROGRESS = 'cg.progress.';

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private mode */ }
}

let settings: Settings = read(K_SETTINGS, DEFAULT_SETTINGS);
let version = 0;
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settings);
}
export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  write(K_SETTINGS, settings);
  emit();
}
export const getSettings = () => settings;

export function getProgress(id: string): Progress | null {
  try { const v = localStorage.getItem(K_PROGRESS + id); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function saveProgress(id: string, p: Progress) {
  write(K_PROGRESS + id, p);
  emit();
}
export function resetProgress(id?: string) {
  try {
    if (id) localStorage.removeItem(K_PROGRESS + id);
    else Object.keys(localStorage).filter((k) => k.startsWith(K_PROGRESS)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  emit();
}
/** re-render when any progress changes */
export function useProgressVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}
