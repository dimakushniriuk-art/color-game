// Segmentazione "a puzzle", a due livelli:
//  - colori FINI (fino a 500): fedeltà dell'immagine colorata
//  - pezzi GRANDI (dettaglio del disegno): pochi bordi puliti; ogni pezzo prende
//    il colore fine prevalente al suo interno (le sfumature restano dentro il pezzo).
// Gira in un Web Worker. Nessuna AI, nessuna rete.
"use strict";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function srgbToLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function linToSrgb(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); }
const LUT = new Float32Array(256); for (let i = 0; i < 256; i++) LUT[i] = srgbToLin(i);
function fLab(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
function labToRgb(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (f) => (f * f * f > 0.008856 ? f * f * f : (f - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  return [linToSrgb(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z), linToSrgb(-0.969266 * X + 1.8760108 * Y + 0.041556 * Z), linToSrgb(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z)];
}

function liscia(L, A, B, w, h, passi, soglia) {          // filtro sigma: ammorbidisce ma tiene i bordi
  const N = w * h, T2 = soglia * soglia, R = 2;
  for (let pass = 0; pass < passi; pass++) {
    const nL = new Float32Array(N), nA = new Float32Array(N), nB = new Float32Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let sl = 0, sa = 0, sb = 0, n = 0;
      for (let dy = -R; dy <= R; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -R; dx <= R; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx, dl = L[j] - L[i], da = A[j] - A[i], db = B[j] - B[i];
          if (dl * dl + da * da + db * db <= T2) { sl += L[j]; sa += A[j]; sb += B[j]; n++; } } }
      nL[i] = sl / n; nA[i] = sa / n; nB[i] = sb / n;
    }
    L.set(nL); A.set(nA); B.set(nB);
  }
}

function kmeans(L, A, B, N, K, rnd, P, pct0, nome) {      // restituisce l'etichetta di ogni pixel
  const S = Math.min(N, 40000), si = new Int32Array(S);
  for (let k = 0; k < S; k++) si[k] = S === N ? k : Math.floor(rnd() * N);
  const cL = new Float32Array(K), cA = new Float32Array(K), cB = new Float32Array(K), D2 = new Float32Array(S).fill(Infinity);
  const f = si[Math.floor(rnd() * S)]; cL[0] = L[f]; cA[0] = A[f]; cB[0] = B[f];
  let kk = 1;
  for (; kk < K; kk++) {
    let tot = 0;
    for (let s = 0; s < S; s++) { const p = si[s], dl = L[p] - cL[kk - 1], da = A[p] - cA[kk - 1], db = B[p] - cB[kk - 1]; const d = dl * dl + da * da + db * db; if (d < D2[s]) D2[s] = d; tot += D2[s]; }
    if (tot <= 1e-6) break;
    let r = rnd() * tot, s = 0; for (; s < S - 1; s++) { r -= D2[s]; if (r <= 0) break; }
    const p = si[s]; cL[kk] = L[p]; cA[kk] = A[p]; cB[kk] = B[p];
  }
  const Kef = kk;
  for (let it = 0; it < 8; it++) {
    P(`${nome}: iterazione ${it + 1}/8…`, pct0 + it);
    const sL = new Float64Array(Kef), sA = new Float64Array(Kef), sB = new Float64Array(Kef), cnt = new Float64Array(Kef);
    for (let s = 0; s < S; s++) { const p = si[s], l = L[p], a = A[p], b = B[p]; let best = 0, bd = Infinity;
      for (let c = 0; c < Kef; c++) { const dl = l - cL[c], da = a - cA[c], db = b - cB[c]; const d = dl * dl + da * da + db * db; if (d < bd) { bd = d; best = c; } }
      sL[best] += l; sA[best] += a; sB[best] += b; cnt[best]++; }
    for (let c = 0; c < Kef; c++) if (cnt[c]) { cL[c] = sL[c] / cnt[c]; cA[c] = sA[c] / cnt[c]; cB[c] = sB[c] / cnt[c]; }
  }
  const lab = new Int32Array(N);
  for (let i = 0; i < N; i++) { const l = L[i], a = A[i], b = B[i]; let best = 0, bd = Infinity;
    for (let c = 0; c < Kef; c++) { const dl = l - cL[c], da = a - cA[c], db = b - cB[c]; const d = dl * dl + da * da + db * db; if (d < bd) { bd = d; best = c; } }
    lab[i] = best; }
  return { lab, K: Kef };
}

function moda(lab, w, h, passi) {
  for (let pass = 0; pass < passi; pass++) {
    const out = new Int32Array(w * h), v = new Int32Array(9);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let n = 0; const cur = lab[y * w + x];
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) v[n++] = lab[yy * w + xx]; } }
      let best = cur, bc = 0;
      for (let a = 0; a < n; a++) { let c = 0; for (let b = 0; b < n; b++) if (v[b] === v[a]) c++; if (c > bc || (c === bc && v[a] === cur)) { bc = c; best = v[a]; } }
      out[y * w + x] = best;
    }
    lab.set(out);
  }
}

// componenti connesse sulla mappa "lab" (4-connessione)
function componenti(lab, w, h, reg, stack) {
  const N = w * h; reg.fill(-1); const area = [], col = []; let n = 0;
  for (let i = 0; i < N; i++) {
    if (reg[i] !== -1) continue;
    const c = lab[i]; let sp = 0, a = 0; stack[sp++] = i; reg[i] = n;
    while (sp) { const p = stack[--sp]; a++; const x = p % w;
      if (x > 0 && reg[p - 1] === -1 && lab[p - 1] === c) { reg[p - 1] = n; stack[sp++] = p - 1; }
      if (x < w - 1 && reg[p + 1] === -1 && lab[p + 1] === c) { reg[p + 1] = n; stack[sp++] = p + 1; }
      if (p >= w && reg[p - w] === -1 && lab[p - w] === c) { reg[p - w] = n; stack[sp++] = p - w; }
      if (p < N - w && reg[p + w] === -1 && lab[p + w] === c) { reg[p + w] = n; stack[sp++] = p + w; } }
    area.push(a); col.push(c); n++;
  }
  return { n, area, col };
}

// fonde i pezzi più piccoli di minArea nel vicino con cui condividono più bordo
function fondiPiccoli(lab, w, h, minArea, P, bar = -1) {
  const N = w * h, reg = new Int32Array(N), stack = new Int32Array(N);
  let comp;
  for (let it = 0; it < 10; it++) {
    P(`Unione dei pezzi piccoli (${it + 1})…`, 72 + it);
    comp = componenti(lab, w, h, reg, stack);
    const small = new Uint8Array(comp.n); let ns = 0;
    for (let r = 0; r < comp.n; r++) if (comp.area[r] < minArea && comp.col[r] !== bar) { small[r] = 1; ns++; }
    if (!ns) break;
    const adj = new Map();
    const add = (a, b) => { if (small[a]) { const k = a * comp.n + b; adj.set(k, (adj.get(k) || 0) + 1); } };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, a = reg[i];
      if (x < w - 1) { const b = reg[i + 1]; if (a !== b) { add(a, b); add(b, a); } }
      if (y < h - 1) { const b = reg[i + w]; if (a !== b) { add(a, b); add(b, a); } } }
    const best = new Int32Array(comp.n).fill(-1), bestC = new Float64Array(comp.n);
    for (const [k, c] of adj) { const a = Math.floor(k / comp.n), b = k - a * comp.n; if (comp.col[b] === bar) continue; const s = c + comp.area[b] * 1e-9; if (s > bestC[a]) { bestC[a] = s; best[a] = b; } }
    let changed = 0;
    for (let i = 0; i < N; i++) { const r = reg[i]; if (small[r] && best[r] >= 0) { lab[i] = comp.col[best[r]]; changed++; } }
    if (!changed) break;
  }
  comp = componenti(lab, w, h, reg, stack);
  return { reg, comp };
}

function segmenta(inp, progress) {
  const { rgba, w, h } = inp, N = w * h, P = progress || (() => {});
  const K = Math.max(2, Math.min(500, inp.K | 0));                 // colori fini
  const Kd = Math.max(2, Math.min(120, inp.Kd | 0 || 24));         // dettaglio del disegno
  const minArea = Math.max(1, inp.minArea | 0);
  const smooth = Math.max(0, Math.min(6, inp.smooth | 0));
  const rnd = mulberry32(12345);

  P("Conversione colori…", 3);
  const L = new Float32Array(N), A = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = LUT[rgba[i * 4]], g = LUT[rgba[i * 4 + 1]], b = LUT[rgba[i * 4 + 2]];
    const x = fLab((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047), y = fLab(0.2126729 * r + 0.7151522 * g + 0.072175 * b), z = fLab((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
    L[i] = 116 * y - 16; A[i] = 500 * (x - y); B[i] = 200 * (y - z);
  }
  const L0 = L.slice(), A0 = A.slice(), B0 = B.slice();

  // --- livello FINE: colori dell'immagine colorata ---
  P("Ammorbidimento leggero…", 8);
  liscia(L, A, B, w, h, Math.min(smooth, 2), 10);
  const fine = kmeans(L, A, B, N, K, rnd, P, 15, "Tavolozza fine");
  moda(fine.lab, w, h, 1);

  // --- livello GROSSO: forme del disegno ---
  P("Semplificazione delle forme…", 35);
  const Ld = L.slice(), Ad = A.slice(), Bd = B.slice();
  liscia(Ld, Ad, Bd, w, h, smooth + 2, 16);
  const gro = kmeans(Ld, Ad, Bd, N, Kd, rnd, P, 50, "Forme");
  P("Pulizia dei bordi…", 65);
  moda(gro.lab, w, h, 3);
  // linee dello sketch come confini: i pezzi non le attraversano (solo le linee abbastanza lunghe, secondo "seguire")
  const seguire = Math.max(0, Math.min(100, inp.seguire | 0)); let usaBar = false; const BAR = gro.K;
  if (inp.barriera && seguire > 0) {
    P("Allineo i pezzi alle linee dello sketch…", 68);
    const b = inp.barriera, Lmin = Math.round(8 + Math.pow(1 - seguire / 100, 2) * 900), vis = new Int32Array(N).fill(-1), st2 = new Int32Array(N), pix = [];
    for (let i = 0; i < N; i++) { if (!b[i] || vis[i] !== -1) continue; let sp = 0; st2[sp++] = i; vis[i] = i; pix.length = 0;
      while (sp) { const p = st2[--sp]; pix.push(p); const x = p % w, y = (p / w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (b[j] && vis[j] === -1) { vis[j] = i; st2[sp++] = j; } } }
      if (pix.length >= Lmin) { for (const p of pix) gro.lab[p] = BAR; usaBar = true; } }
  }
  let { reg, comp } = fondiPiccoli(gro.lab, w, h, minArea, P, usaBar ? BAR : -1);
  if (usaBar) { // i pixel di linea passano al pezzo vicino, i pezzi restano separati dalla linea
    const full = new Int32Array(N); let q = new Int32Array(N), qn = 0;
    for (let i = 0; i < N; i++) { if (comp.col[reg[i]] === BAR) full[i] = -1; else { full[i] = reg[i]; q[qn++] = i; } }
    while (qn) { const nq = new Int32Array(N); let nn = 0;
      for (let k = 0; k < qn; k++) { const p = q[k], x = p % w, r = full[p];
        if (x > 0 && full[p - 1] < 0) { full[p - 1] = r; nq[nn++] = p - 1; }
        if (x < w - 1 && full[p + 1] < 0) { full[p + 1] = r; nq[nn++] = p + 1; }
        if (p >= w && full[p - w] < 0) { full[p - w] = r; nq[nn++] = p - w; }
        if (p < N - w && full[p + w] < 0) { full[p + w] = r; nq[nn++] = p + w; } }
      q = nq; qn = nn; }
    for (let i = 0; i < N; i++) if (full[i] < 0) full[i] = 0;
    comp = componenti(full, w, h, reg, new Int32Array(N));
  }

  // --- colore fine prevalente in ogni pezzo ---
  P("Colore prevalente di ogni pezzo…", 85);
  const R = comp.n, Kf = fine.K;
  const regColF = new Int32Array(R);
  if (R * Kf <= 40e6) {
    const hist = new Uint32Array(R * Kf);
    for (let i = 0; i < N; i++) hist[reg[i] * Kf + fine.lab[i]]++;
    for (let r = 0; r < R; r++) { let b = 0, bc = -1, o = r * Kf; for (let c = 0; c < Kf; c++) if (hist[o + c] > bc) { bc = hist[o + c]; b = c; } regColF[r] = b; }
  } else {
    const m = new Map(); for (let i = 0; i < N; i++) { const k = reg[i] * Kf + fine.lab[i]; m.set(k, (m.get(k) || 0) + 1); }
    const bc = new Float64Array(R).fill(-1);
    for (const [k, c] of m) { const r = Math.floor(k / Kf); if (c > bc[r]) { bc[r] = c; regColF[r] = k - r * Kf; } }
  }
  // pezzi vicini con lo stesso colore prevalente -> un solo pezzo (meno linee inutili)
  if (usaBar) { comp.col = Array.from(regColF); }   // con lo sketch non unisco i pezzi separati da una linea
  else { const lab2 = new Int32Array(N); for (let i = 0; i < N; i++) lab2[i] = regColF[reg[i]]; comp = componenti(lab2, w, h, reg, new Int32Array(N)); }

  // tavolozze: colore medio reale di ogni colore fine
  const sL = new Float64Array(Kf), sA = new Float64Array(Kf), sB = new Float64Array(Kf), cnt = new Float64Array(Kf);
  for (let i = 0; i < N; i++) { const c = fine.lab[i]; sL[c] += L0[i]; sA[c] += A0[i]; sB[c] += B0[i]; cnt[c]++; }
  const finePal = []; for (let c = 0; c < Kf; c++) finePal.push(cnt[c] ? labToRgb(sL[c] / cnt[c], sA[c] / cnt[c], sB[c] / cnt[c]) : [255, 255, 255]);
  // numeri del disegno: solo i colori prevalenti usati, ordinati per area
  const areaCol = new Float64Array(Kf); for (let r = 0; r < comp.n; r++) areaCol[comp.col[r]] += comp.area[r];
  const usati = []; for (let c = 0; c < Kf; c++) if (areaCol[c]) usati.push(c);
  usati.sort((a, b) => areaCol[b] - areaCol[a]);
  const idx = new Int32Array(Kf).fill(-1); const palette = [], counts = [];
  usati.forEach((c, j) => { idx[c] = j; palette.push(finePal[c]); counts.push(areaCol[c]); });
  const regColor = new Int32Array(comp.n); for (let r = 0; r < comp.n; r++) regColor[r] = idx[comp.col[r]];
  const fineLab = new Uint16Array(N); for (let i = 0; i < N; i++) fineLab[i] = fine.lab[i];

  // posizione dei numeri: punto più lontano dai bordi
  P("Posizione dei numeri…", 94);
  const dist = new Float32Array(N), INF = 1e9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, r = reg[i];
    dist[i] = (x === 0 || y === 0 || x === w - 1 || y === h - 1 || reg[i - 1] !== r || reg[i + 1] !== r || reg[i - w] !== r || reg[i + w] !== r) ? 0 : INF; }
  for (let y = 1; y < h; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (dist[i]) dist[i] = Math.min(dist[i], dist[i - 1] + 3, dist[i - w] + 3, dist[i - w - 1] + 4, dist[i - w + 1] + 4); }
  for (let y = h - 2; y >= 0; y--) for (let x = w - 2; x > 0; x--) { const i = y * w + x; if (dist[i]) dist[i] = Math.min(dist[i], dist[i + 1] + 3, dist[i + w] + 3, dist[i + w + 1] + 4, dist[i + w - 1] + 4); }
  const pos = new Float32Array(comp.n * 3);
  for (let i = 0; i < N; i++) { const r = reg[i], d = dist[i] / 3; if (d > pos[r * 3 + 2]) { pos[r * 3] = i % w; pos[r * 3 + 1] = (i / w) | 0; pos[r * 3 + 2] = d; } }

  P("Fatto", 100);
  return { w, h, nReg: comp.n, reg, regColor, palette, counts, pos, fineLab, finePal, nFine: usati.length, kFine: Kf };
}

if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof window === "undefined") {
  self.onmessage = (e) => {
    try {
      const t0 = Date.now();
      const res = segmenta(e.data, (msg, pct) => self.postMessage({ tipo: "progresso", msg, pct }));
      res.ms = Date.now() - t0;
      self.postMessage({ tipo: "fatto", res }, [res.reg.buffer, res.regColor.buffer, res.pos.buffer, res.fineLab.buffer]);
    } catch (err) { self.postMessage({ tipo: "errore", msg: String((err && err.message) || err) }); }
  };
}
if (typeof module !== "undefined") module.exports = { segmenta };
