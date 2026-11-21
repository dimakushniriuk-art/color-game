// Built-in demo drawings, so the app is playable before real packages are published.
// Each scene is drawn with flat colours in a 100×100 space, then segmented into regions.

type Ctx = CanvasRenderingContext2D;

export interface DemoScene {
  id: string;
  title: string;
  category: string;
  difficulty: 'facile' | 'medio' | 'difficile';
  palette: string[];
  draw: (c: Ctx, P: string[]) => void;
}

const circle = (c: Ctx, x: number, y: number, r: number, fill: string) => {
  c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
};
const ellipse = (c: Ctx, x: number, y: number, rx: number, ry: number, rot: number, fill: string) => {
  c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill();
};
const poly = (c: Ctx, pts: number[], fill: string) => {
  c.fillStyle = fill; c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath(); c.fill();
};
const rect = (c: Ctx, x: number, y: number, w: number, h: number, fill: string) => {
  c.fillStyle = fill; c.fillRect(x, y, w, h);
};
const petals = (c: Ctx, cx: number, cy: number, n: number, dist: number, rx: number, ry: number, off: number, fill: string) => {
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    ellipse(c, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, rx, ry, a, fill);
  }
};
const cloud = (c: Ctx, x: number, y: number, s: number, fill: string) => {
  circle(c, x, y, 5 * s, fill); circle(c, x + 6 * s, y - 2 * s, 6 * s, fill);
  circle(c, x + 12 * s, y, 5 * s, fill); rect(c, x, y, 12 * s, 5 * s, fill);
};

export const DEMO_SCENES: DemoScene[] = [
  {
    id: 'demo-tramonto', title: 'Tramonto in montagna', category: 'Paesaggi', difficulty: 'medio',
    palette: ['#2b3a67', '#5c4d7d', '#a85d84', '#f0866b', '#f9c784', '#fff1b8', '#8a6fa8', '#45417a', '#2e2a52', '#e8a87c', '#c38d9e', '#1d1b3a'],
    draw(c, P) {
      const bands = [P[0], P[1], P[2], P[3], P[4]];
      bands.forEach((col, i) => rect(c, 0, i * 13, 100, 14, col));
      circle(c, 66, 50, 13, P[5]);
      poly(c, [0, 62, 18, 36, 34, 52, 52, 30, 72, 54, 88, 38, 100, 50, 100, 72, 0, 72], P[6]);
      poly(c, [0, 70, 14, 50, 30, 64, 46, 46, 62, 66, 80, 52, 100, 68, 100, 74, 0, 74], P[7]);
      poly(c, [0, 74, 22, 60, 40, 72, 100, 70, 100, 76, 0, 76], P[8]);
      for (let i = 0; i < 5; i++) rect(c, 0, 75 + i * 5, 100, 5, i % 2 ? P[10] : P[9]);
      for (let i = 0; i < 4; i++) rect(c, 58 - i * 2, 77 + i * 5, 16 + i * 4, 1.6, P[5]);
      for (const [x, s] of [[6, 1], [13, 1.3], [88, 1.2], [95, 0.9]] as const) {
        poly(c, [x, 52 - 26 * s * 0.6, x - 5 * s, 76, x + 5 * s, 76], P[11]);
      }
    },
  },
  {
    id: 'demo-casetta', title: 'Casetta sulla collina', category: 'Paesaggi', difficulty: 'facile',
    palette: ['#9ad0ec', '#ffffff', '#ffd166', '#8cc084', '#5c946e', '#f4e1c1', '#c0504d', '#7a4e2d', '#bfe3f2', '#9c6644', '#3f7d4e', '#e0c097', '#ff70a6'],
    draw(c, P) {
      rect(c, 0, 0, 100, 100, P[0]);
      circle(c, 84, 16, 9, P[2]);
      cloud(c, 10, 14, 1.1, P[1]); cloud(c, 48, 24, 0.8, P[1]);
      ellipse(c, 75, 92, 70, 30, 0, P[4]);
      ellipse(c, 20, 96, 70, 30, 0, P[3]);
      rect(c, 58, 30, 6, 14, P[9]);
      rect(c, 30, 46, 40, 30, P[5]);
      poly(c, [24, 48, 50, 26, 76, 48], P[6]);
      rect(c, 45, 58, 10, 18, P[7]);
      rect(c, 34, 52, 8, 8, P[8]); rect(c, 58, 52, 8, 8, P[8]);
      poly(c, [45, 76, 55, 76, 66, 100, 34, 100], P[11]);
      rect(c, 84, 58, 4, 22, P[7]);
      circle(c, 86, 52, 10, P[10]); circle(c, 80, 58, 6, P[10]); circle(c, 92, 58, 6, P[10]);
      for (const [x, y] of [[12, 84], [20, 90], [8, 94], [76, 88], [90, 92]]) petals(c, x, y, 5, 1.6, 1.4, 1, 0, P[12]);
    },
  },
  {
    id: 'demo-fiore', title: 'Fiore in vaso', category: 'Natura', difficulty: 'medio',
    palette: ['#fdf0d5', '#f6d7a7', '#ff6b6b', '#ff9e9e', '#ffd23f', '#e09f3e', '#4f772d', '#90a955', '#bc6c25', '#dda15e', '#8d6346'],
    draw(c, P) {
      for (let i = 0; i < 10; i++) rect(c, i * 10, 0, 10, 100, i % 2 ? P[1] : P[0]);
      rect(c, 0, 84, 100, 16, P[10]);
      rect(c, 48.5, 40, 3, 40, P[6]);
      ellipse(c, 40, 60, 10, 4, -0.5, P[7]); ellipse(c, 60, 52, 10, 4, 0.5, P[7]);
      petals(c, 50, 32, 8, 13, 9, 5, 0, P[2]);
      petals(c, 50, 32, 8, 8, 5, 3, Math.PI / 8, P[3]);
      circle(c, 50, 32, 7, P[4]);
      for (let i = 0; i < 6; i++) circle(c, 50 + Math.cos(i) * 3.5, 32 + Math.sin(i) * 3.5, 1.2, P[5]);
      poly(c, [34, 72, 66, 72, 61, 92, 39, 92], P[8]);
      rect(c, 32, 68, 36, 6, P[9]);
    },
  },
  {
    id: 'demo-pesce', title: 'Pesce nel reef', category: 'Animali', difficulty: 'medio',
    palette: ['#0b6e99', '#1c8fbf', '#3fb0d9', '#ff9f1c', '#ffffff', '#e76f51', '#1b1b1b', '#cdeffd', '#2a9d8f', '#3ac17e', '#f4d58d', '#c9a66b', '#ef476f'],
    draw(c, P) {
      rect(c, 0, 0, 100, 34, P[2]); rect(c, 0, 34, 100, 33, P[1]); rect(c, 0, 67, 100, 33, P[0]);
      ellipse(c, 50, 104, 80, 18, 0, P[10]);
      circle(c, 20, 92, 3, P[11]); circle(c, 70, 94, 2.5, P[11]); circle(c, 84, 90, 2, P[11]);
      for (const x of [8, 14, 88]) { ellipse(c, x, 76, 3, 16, 0.15, P[8]); ellipse(c, x + 3, 80, 2.5, 12, -0.2, P[9]); }
      petals(c, 32, 90, 5, 3.5, 3.5, 1.6, -Math.PI / 2, P[12]); circle(c, 32, 90, 2, P[12]);
      poly(c, [72, 48, 90, 34, 86, 48, 90, 62], P[5]);
      poly(c, [44, 34, 56, 24, 62, 36], P[5]);
      poly(c, [46, 62, 56, 72, 60, 60], P[5]);
      ellipse(c, 50, 48, 24, 15, 0, P[3]);
      for (const x of [40, 52, 62]) { c.save(); c.beginPath(); c.ellipse(50, 48, 24, 15, 0, 0, Math.PI * 2); c.clip(); rect(c, x, 30, 4, 40, P[4]); c.restore(); }
      circle(c, 34, 44, 4, P[4]); circle(c, 33, 44, 2, P[6]);
      for (const [x, y, r] of [[22, 30, 2.5], [18, 20, 1.8], [24, 12, 1.4], [70, 16, 2], [76, 8, 1.4]]) circle(c, x, y, r, P[7]);
    },
  },
  {
    id: 'demo-gatto', title: 'Gatto sul cuscino', category: 'Animali', difficulty: 'facile',
    palette: ['#b8e0d2', '#d6eadf', '#f4a259', '#d1793b', '#fbe3c8', '#f7b2b7', '#7fc97f', '#2d2d2d', '#e56b6f', '#5b8e7d', '#8cb369'],
    draw(c, P) {
      rect(c, 0, 0, 100, 100, P[0]);
      circle(c, 50, 44, 40, P[1]);
      ellipse(c, 50, 86, 44, 12, 0, P[9]);
      for (let i = 0; i < 5; i++) circle(c, 16 + i * 17, 86, 3, P[10]);
      ellipse(c, 50, 70, 24, 16, 0, P[2]);
      poly(c, [30, 34, 34, 12, 46, 28], P[2]); poly(c, [70, 34, 66, 12, 54, 28], P[2]);
      poly(c, [33, 30, 35, 18, 42, 28], P[5]); poly(c, [67, 30, 65, 18, 58, 28], P[5]);
      circle(c, 50, 42, 20, P[2]);
      rect(c, 44, 22, 3, 8, P[3]); rect(c, 53, 22, 3, 8, P[3]);
      for (const y of [62, 70]) { rect(c, 28, y, 8, 3, P[3]); rect(c, 64, y, 8, 3, P[3]); }
      ellipse(c, 50, 50, 10, 7, 0, P[4]);
      ellipse(c, 42, 40, 4, 5, 0, P[6]); ellipse(c, 58, 40, 4, 5, 0, P[6]);
      ellipse(c, 42, 40, 1.5, 4, 0, P[7]); ellipse(c, 58, 40, 1.5, 4, 0, P[7]);
      poly(c, [47, 47, 53, 47, 50, 51], P[8]);
    },
  },
  {
    id: 'demo-mongolfiera', title: 'Mongolfiera', category: 'Paesaggi', difficulty: 'difficile',
    palette: ['#cdeafe', '#a9d6f5', '#ffffff', '#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#8d5b3e', '#5a3d2b', '#7fb685', '#5e9c6a'],
    draw(c, P) {
      rect(c, 0, 0, 100, 50, P[0]); rect(c, 0, 50, 100, 50, P[1]);
      cloud(c, 6, 20, 1, P[2]); cloud(c, 70, 60, 1.2, P[2]); cloud(c, 76, 14, 0.7, P[2]);
      poly(c, [0, 100, 0, 80, 20, 70, 44, 84, 60, 74, 80, 82, 100, 72, 100, 100], P[9]);
      poly(c, [0, 100, 0, 90, 30, 82, 56, 92, 84, 86, 100, 92, 100, 100], P[10]);
      c.save(); c.beginPath(); c.ellipse(48, 34, 24, 28, 0, 0, Math.PI * 2); c.clip();
      const cols = [P[3], P[4], P[5], P[6]];
      for (let i = 0; i < 8; i++) { c.save(); c.translate(48, 34); c.scale(1 - Math.abs(i - 3.5) * 0.0, 1); rect(c, -24 + i * 6, -30, 6, 60, cols[i % 4]); c.restore(); }
      rect(c, 20, 18, 56, 4, P[4]);
      c.restore();
      poly(c, [36, 56, 60, 56, 54, 64, 42, 64], P[3]);
      rect(c, 41, 64, 1.2, 8, P[8]); rect(c, 53.8, 64, 1.2, 8, P[8]);
      rect(c, 40, 72, 16, 8, P[7]);
      rect(c, 40, 72, 16, 2, P[8]);
    },
  },
  {
    id: 'demo-mandala', title: 'Mandala', category: 'Mandala', difficulty: 'difficile',
    palette: ['#2d1e2f', '#f2a541', '#f08a4b', '#d64933', '#7a306c', '#3b8ea5', '#97cc04', '#f6f7eb', '#5c2a9d'],
    draw(c, P) {
      rect(c, 0, 0, 100, 100, P[0]);
      circle(c, 50, 50, 47, P[8]);
      petals(c, 50, 50, 16, 38, 8, 4, 0, P[1]);
      circle(c, 50, 50, 34, P[4]);
      petals(c, 50, 50, 12, 28, 7, 3.6, Math.PI / 12, P[5]);
      circle(c, 50, 50, 23, P[3]);
      petals(c, 50, 50, 10, 17, 6, 3, 0, P[2]);
      petals(c, 50, 50, 10, 17, 3, 1.4, 0, P[7]);
      circle(c, 50, 50, 11, P[6]);
      petals(c, 50, 50, 8, 6, 3.5, 2, Math.PI / 8, P[1]);
      circle(c, 50, 50, 3.5, P[7]);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + Math.PI / 16; circle(c, 50 + Math.cos(a) * 44, 50 + Math.sin(a) * 44, 1.6, P[7]); }
      for (const [x, y] of [[6, 6], [94, 6], [6, 94], [94, 94]]) { petals(c, x, y, 6, 3, 2.4, 1.2, 0, P[2]); circle(c, x, y, 1.4, P[1]); }
    },
  },
  {
    id: 'demo-farfalla', title: 'Farfalla', category: 'Natura', difficulty: 'medio',
    palette: ['#e9f5db', '#cfe1b9', '#7b2cbf', '#c77dff', '#ffd60a', '#3a86ff', '#8ecae6', '#2b2d42', '#ffffff'],
    draw(c, P) {
      rect(c, 0, 0, 100, 100, P[0]);
      for (const [x, y] of [[10, 12], [88, 18], [14, 86], [86, 84], [50, 92], [50, 8]]) petals(c, x, y, 6, 3.4, 2.6, 1.6, 0, P[1]);
      for (const s of [-1, 1]) {
        c.save(); c.translate(50, 50); c.scale(s, 1);
        ellipse(c, 18, -14, 20, 15, -0.5, P[2]);
        ellipse(c, 18, -14, 13, 9, -0.5, P[3]);
        circle(c, 22, -18, 4, P[4]); circle(c, 12, -10, 2.4, P[8]);
        ellipse(c, 15, 16, 14, 11, 0.6, P[5]);
        ellipse(c, 15, 16, 8, 6, 0.6, P[6]);
        circle(c, 18, 19, 2.4, P[4]);
        c.lineWidth = 1.4; c.strokeStyle = P[7]; c.beginPath(); c.moveTo(1, -26); c.quadraticCurveTo(6, -36, 12, -38); c.stroke();
        c.restore();
      }
      ellipse(c, 50, 50, 3, 22, 0, P[7]);
      circle(c, 50, 26, 3.4, P[7]);
    },
  },
];

const CELL: Record<DemoScene['difficulty'], number> = { facile: 0, medio: 0.13, difficile: 0.085 };

/** Renders the scene to RGBA at the given size. */
export function renderScene(scene: DemoScene, size: number): { rgba: Uint8ClampedArray; cellSize: number } {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const c = canvas.getContext('2d', { willReadFrequently: true })!;
  c.scale(size / 100, size / 100);
  scene.draw(c, scene.palette);
  return { rgba: c.getImageData(0, 0, size, size).data, cellSize: Math.round(CELL[scene.difficulty] * size) };
}
