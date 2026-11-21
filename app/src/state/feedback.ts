import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { getSettings } from './store';

let audio: AudioContext | null = null;

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0) {
  if (!getSettings().sound) return;
  try {
    audio ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = audio.currentTime + delay;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur);
  } catch { /* audio unavailable */ }
}

const haptic = (fn: () => Promise<void>) => { if (getSettings().haptics) fn().catch(() => {}); };

export const feedback = {
  fill() { tone(520, 0.08, 'triangle', 0.05); haptic(() => Haptics.impact({ style: ImpactStyle.Light })); },
  wrong() { tone(160, 0.12, 'square', 0.03); haptic(() => Haptics.impact({ style: ImpactStyle.Medium })); },
  colorDone() { tone(660, 0.12, 'sine', 0.07); tone(880, 0.18, 'sine', 0.07, 0.1); haptic(() => Haptics.notification({ type: NotificationType.Success })); },
  complete() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'sine', 0.07, i * 0.12)); haptic(() => Haptics.notification({ type: NotificationType.Success })); },
  tap() { haptic(() => Haptics.selectionChanged()); },
};
