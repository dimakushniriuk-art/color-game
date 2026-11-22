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

// componenti connesse sulla mappa "lab" (4-connessione); i pixel con lab < 0 (linee) restano -1
function componenti(lab, w, h, reg, stack) {
  const N = w * h; reg.fill(-1); const area = [], col = []; let n = 0;
  for (let i = 0; i < N; i++) {
    if (reg[i] !== -1 || lab[i] < 0) continue;
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

// i pixel ancora senza pezzo (linee dello sketch) passano al pezzo più vicino: nessun buco, nessuna sovrapposizione
function riempiVuoti(reg, w, h) {
  const N = w * h; let q = new Int32Array(N), qn = 0;
  for (let i = 0; i < N; i++) if (reg[i] >= 0) q[qn++] = i;
  if (!qn) { reg.fill(0); return; }
  while (qn) { const nq = new Int32Array(qn * 4 + 4); let nn = 0;
    for (let k = 0; k < qn; k++) { const p = q[k], x = p % w, r = reg[p];
      if (x > 0 && reg[p - 1] < 0) { reg[p - 1] = r; nq[nn++] = p - 1; }
      if (x < w - 1 && reg[p + 1] < 0) { reg[p + 1] = r; nq[nn++] = p + 1; }
      if (p >= w && reg[p - w] < 0) { reg[p - w] = r; nq[nn++] = p - w; }
      if (p < N - w && reg[p + w] < 0) { reg[p + w] = r; nq[nn++] = p + w; } }
    q = nq; qn = nn; }
}

// rinumera i pezzi 0..n-1 dopo le unioni
function compatta(reg, N) {
  const map = new Map(); let n = 0;
  for (let i = 0; i < N; i++) { let v = map.get(reg[i]); if (v === undefined) { v = n++; map.set(reg[i], v); } reg[i] = v; }
  return n;
}

// raggio del cerchio più grande che sta dentro ogni pezzo (distanza dal bordo, in pixel)
function raggioMax(reg, w, h, n) {
  const N = w * h, d = new Float32Array(N), INF = 1e9, out = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, r = reg[i];
    d[i] = (x === 0 || y === 0 || x === w - 1 || y === h - 1 || reg[i - 1] !== r || reg[i + 1] !== r || reg[i - w] !== r || reg[i + w] !== r) ? 1 : INF; }
  for (let y = 1; y < h; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (d[i] > 1) d[i] = Math.min(d[i], d[i - 1] + 1, d[i - w] + 1, d[i - w - 1] + 1.4142, d[i - w + 1] + 1.4142); }
  for (let y = h - 2; y >= 0; y--) for (let x = w - 2; x > 0; x--) { const i = y * w + x; if (d[i] > 1) d[i] = Math.min(d[i], d[i + 1] + 1, d[i + w] + 1, d[i + w + 1] + 1.4142, d[i + w - 1] + 1.4142); }
  for (let i = 0; i < N; i++) if (d[i] > out[reg[i]]) out[reg[i]] = d[i];
  return out;
}

// confini condivisi tra pezzi: [lungo una linea dello sketch, fuori dalle linee]
function adiacenze(reg, w, h, n, linea) {
  const m = new Map();
  const add = (a, b, sulla) => { const k = a < b ? a * n + b : b * n + a; let e = m.get(k); if (!e) { e = [0, 0]; m.set(k, e); } e[sulla ? 0 : 1]++; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, a = reg[i];
    if (x < w - 1) { const b = reg[i + 1]; if (a !== b) add(a, b, linea[i] || linea[i + 1]); }
    if (y < h - 1) { const b = reg[i + w]; if (a !== b) add(a, b, linea[i] || linea[i + w]); } }
  const vic = Array.from({ length: n }, () => []);
  for (const [k, e] of m) { const a = Math.floor(k / n), b = k - a * n; vic[a].push(b, e[0], e[1]); vic[b].push(a, e[0], e[1]); }
  return vic;
}

/**
 * Unisce i pezzi troppo piccoli o troppo sottili al vicino più adatto:
 * stesso lato della linea dello sketch, confine più lungo, colore più simile.
 * Attraversa una linea solo se il pezzo è chiuso interamente da linee.
 */
function unisciPiccoli(reg, w, h, linea, L, A, B, req, P, pct0) {
  const N = w * h; let n = compatta(reg, N);
  for (let giro = 0; giro < 40; giro++) {
    P(`Pezzi troppo piccoli: unione (${giro + 1})…`, Math.min(pct0 + giro, pct0 + 12));
    const area = new Float64Array(n), sL = new Float64Array(n), sA = new Float64Array(n), sB = new Float64Array(n), sX = new Float64Array(n), sY = new Float64Array(n);
    for (let i = 0; i < N; i++) { const r = reg[i]; area[r]++; sL[r] += L[i]; sA[r] += A[i]; sB[r] += B[i]; sX[r] += i % w; sY[r] += (i / w) | 0; }
    const rmax = req.spessore ? raggioMax(reg, w, h, n) : null;
    const minimo = new Float64Array(n), piccolo = new Uint8Array(n); let ns = 0;
    for (let r = 0; r < n; r++) {
      const m = req.minimoIn(sX[r] / area[r], sY[r] / area[r]); minimo[r] = m;
      if (area[r] < m || (rmax && rmax[r] < req.raggio(m))) { piccolo[r] = 1; ns++; }
    }
    if (!ns) break;
    const vic = adiacenze(reg, w, h, n, linea);
    const padre = new Int32Array(n); for (let r = 0; r < n; r++) padre[r] = r;
    const trova = (r) => { while (padre[r] !== r) { padre[r] = padre[padre[r]]; r = padre[r]; } return r; };
    const ordine = []; for (let r = 0; r < n; r++) if (piccolo[r]) ordine.push(r);
    ordine.sort((a, b) => area[a] - area[b]);
    let uniti = 0;
    for (const r of ordine) {
      if (trova(r) !== r) continue;
      if (area[r] >= minimo[r] && !(rmax && rmax[r] < req.raggio(minimo[r]))) continue;
      const l = sL[r] / area[r], a = sA[r] / area[r], b = sB[r] / area[r], v = vic[r];
      let best = -1, bs = -1;
      for (let k = 0; k < v.length; k += 3) {
        const t = trova(v[k]); if (t === r) continue;
        const fuori = v[k + 2], sulla = v[k + 1];
        const dl = sL[t] / area[t] - l, da = sA[t] / area[t] - a, db = sB[t] / area[t] - b;
        const s = (fuori + sulla * 0.02) / (1 + Math.sqrt(dl * dl + da * da + db * db) / 8);
        if (s > bs) { bs = s; best = t; }
      }
      if (best < 0) continue;
      padre[r] = best; uniti++;
      area[best] += area[r]; sL[best] += sL[r]; sA[best] += sA[r]; sB[best] += sB[r]; sX[best] += sX[r]; sY[best] += sY[r];
    }
    if (!uniti) break;
    for (let i = 0; i < N; i++) reg[i] = trova(reg[i]);
    n = compatta(reg, N);
  }
  return n;
}

// bordi più morbidi (forme a puzzle, non seghettate): ogni pixel prende il pezzo più frequente attorno a sé.
// I pixel delle linee non cambiano e non votano, così i confini restano sulle linee dello sketch.
function lisciaBordi(reg, w, h, linea, passi, R) {
  const N = w * h, ids = new Int32Array((2 * R + 1) ** 2), cnt = new Int32Array((2 * R + 1) ** 2);
  for (let pass = 0; pass < passi; pass++) {
    const out = reg.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (linea[i]) continue;
      const cur = reg[i];
      // solo i pixel vicini a un confine possono cambiare
      if ((x === 0 || reg[i - 1] === cur) && (x === w - 1 || reg[i + 1] === cur) && (y === 0 || reg[i - w] === cur) && (y === h - 1 || reg[i + w] === cur)) continue;
      let k = 0;
      for (let dy = -R; dy <= R; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -R; dx <= R; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; const j = yy * w + xx; if (linea[j]) continue;
          const v = reg[j]; let t = 0; while (t < k && ids[t] !== v) t++; if (t === k) { ids[k] = v; cnt[k] = 0; k++; } cnt[t]++; } }
      let best = cur, bc = -1; for (let t = 0; t < k; t++) if (cnt[t] > bc || (cnt[t] === bc && ids[t] === cur)) { bc = cnt[t]; best = ids[t]; }
      out[i] = best;
    }
    reg.set(out);
  }
  // ricostruisce pezzi connessi (la lisciatura può staccare piccoli frammenti)
  const lab = reg.slice(); componenti(lab, w, h, reg, new Int32Array(N));
}

// colore fine prevalente di ogni pezzo
function colorePrevalente(reg, fineLab, N, n, Kf) {
  const out = new Int32Array(n);
  if (n * Kf <= 40e6) {
    const hist = new Uint32Array(n * Kf);
    for (let i = 0; i < N; i++) hist[reg[i] * Kf + fineLab[i]]++;
    for (let r = 0; r < n; r++) { let b = 0, bc = -1; const o = r * Kf; for (let c = 0; c < Kf; c++) if (hist[o + c] > bc) { bc = hist[o + c]; b = c; } out[r] = b; }
  } else {
    const m = new Map(); for (let i = 0; i < N; i++) { const k = reg[i] * Kf + fineLab[i]; m.set(k, (m.get(k) || 0) + 1); }
    const bc = new Float64Array(n).fill(-1);
    for (const [k, c] of m) { const r = Math.floor(k / Kf); if (c > bc[r]) { bc[r] = c; out[r] = k - r * Kf; } }
  }
  return out;
}

// pezzi vicini con lo stesso colore e un confine che NON è una linea dello sketch -> un pezzo solo
function unisciStessoColore(reg, w, h, n, linea, col) {
  const vic = adiacenze(reg, w, h, n, linea), padre = new Int32Array(n);
  for (let r = 0; r < n; r++) padre[r] = r;
  const trova = (r) => { while (padre[r] !== r) { padre[r] = padre[padre[r]]; r = padre[r]; } return r; };
  for (let a = 0; a < n; a++) { const v = vic[a];
    for (let k = 0; k < v.length; k += 3) { const b = v[k]; if (b <= a || col[a] !== col[b]) continue;
      if (v[k + 2] > v[k + 1]) { const ra = trova(a), rb = trova(b); if (ra !== rb) padre[ra] = rb; } } }
  const N = w * h; for (let i = 0; i < N; i++) reg[i] = trova(reg[i]);
  return compatta(reg, N);
}

function segmenta(inp, progress) {
  const { rgba, w, h } = inp, N = w * h, P = progress || (() => {});
  const K = Math.max(2, Math.min(500, inp.K | 0));                 // colori fini
  const Kd = Math.max(2, Math.min(120, inp.Kd | 0 || 24));         // dettaglio del disegno
  // pezzo minimo in % dell'immagine (0,07% = regola del gioco); nelle zone viso può essere più piccolo
  const minPct = inp.minPct > 0 ? inp.minPct : 0.07, minPctViso = inp.minPctViso > 0 ? Math.min(inp.minPctViso, minPct) : minPct;
  const minArea = Math.max(4, Math.round(minPct / 100 * N)), minViso = Math.max(4, Math.round(minPctViso / 100 * N));
  const visi = (inp.visi || []).map((v) => [v[0] * w, v[1] * h, v[2] * w, v[3] * h]);
  const req = {
    spessore: inp.spessore !== false,
    minimoIn: (x, y) => { for (const v of visi) if (x >= v[0] && x <= v[2] && y >= v[1] && y <= v[3]) return minViso; return minArea; },
    raggio: (m) => Math.max(1.5, 0.2 * Math.sqrt(m)), // spessore minimo: cerchio di diametro ≈ 40% del lato del pezzo minimo
  };
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
  // linee dello sketch = confini: i pezzi non le attraversano (solo le linee abbastanza lunghe, secondo "seguire")
  const seguire = Math.max(0, Math.min(100, inp.seguire | 0)), linea = new Uint8Array(N);
  if (inp.barriera && seguire > 0) {
    P("Allineo i pezzi alle linee dello sketch…", 68);
    const b = inp.barriera, Lmin = Math.round(8 + Math.pow(1 - seguire / 100, 2) * 900), vis = new Int32Array(N).fill(-1), st2 = new Int32Array(N), pix = [];
    for (let i = 0; i < N; i++) { if (!b[i] || vis[i] !== -1) continue; let sp = 0; st2[sp++] = i; vis[i] = i; pix.length = 0;
      while (sp) { const p = st2[--sp]; pix.push(p); const x = p % w, y = (p / w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (b[j] && vis[j] === -1) { vis[j] = i; st2[sp++] = j; } } }
      if (pix.length >= Lmin) for (const p of pix) linea[p] = 1; }
  }
  // pezzi iniziali: forme del disegno, mai a cavallo di una linea
  const lab0 = gro.lab; for (let i = 0; i < N; i++) if (linea[i]) lab0[i] = -1;
  const reg = new Int32Array(N);
  componenti(lab0, w, h, reg, new Int32Array(N));
  riempiVuoti(reg, w, h);
  // pezzi troppo piccoli o sottili -> uniti; poi pezzi vicini dello stesso colore -> uniti; poi controllo finale
  let n = unisciPiccoli(reg, w, h, linea, L0, A0, B0, req, P, 72);
  P("Unisco i pezzi vicini dello stesso colore…", 85);
  n = unisciStessoColore(reg, w, h, n, linea, colorePrevalente(reg, fine.lab, N, n, fine.K));
  P("Ammorbidisco i bordi dei pezzi…", 86);
  lisciaBordi(reg, w, h, linea, 3, 2);
  n = unisciPiccoli(reg, w, h, linea, L0, A0, B0, req, P, 88);
  const Kf = fine.K;
  const comp = { n, col: Array.from(colorePrevalente(reg, fine.lab, N, n, Kf)), area: new Array(n).fill(0) };
  for (let i = 0; i < N; i++) comp.area[reg[i]]++;

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
  return { w, h, nReg: comp.n, reg, regColor, palette, counts, pos, fineLab, finePal, nFine: usati.length, kFine: Kf, linea, minArea, minViso };
}

// qualità di un risultato: differenza media di colore (ΔE) tra l'originale e il colore del suo pezzo
function errore(rgba, res) {
  const N = res.w * res.h, pal = res.palette.map(([r, g, b]) => { const R = LUT[r], G = LUT[g], B = LUT[b];
    const x = fLab((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047), y = fLab(0.2126729 * R + 0.7151522 * G + 0.072175 * B), z = fLab((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; });
  let tot = 0;
  for (let i = 0; i < N; i++) {
    const R = LUT[rgba[i * 4]], G = LUT[rgba[i * 4 + 1]], B = LUT[rgba[i * 4 + 2]];
    const x = fLab((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047), y = fLab(0.2126729 * R + 0.7151522 * G + 0.072175 * B), z = fLab((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
    const c = pal[res.regColor[res.reg[i]]], dl = 116 * y - 16 - c[0], da = 500 * (x - y) - c[1], db = 200 * (y - z) - c[2];
    tot += Math.sqrt(dl * dl + da * da + db * db);
  }
  return tot / N;
}

// sfocatura leggera (3 passate di media a box): il confronto guarda le forme e i colori, non la grana del dipinto
function sfoca(rgba, w, h, R) {
  let a = new Float32Array(w * h * 3); for (let i = 0; i < w * h; i++) { a[i * 3] = rgba[i * 4]; a[i * 3 + 1] = rgba[i * 4 + 1]; a[i * 3 + 2] = rgba[i * 4 + 2]; }
  for (let pass = 0; pass < 3; pass++) for (const dir of [0, 1]) { const b = new Float32Array(a.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s0 = 0, s1 = 0, s2 = 0, n = 0;
      for (let k = -R; k <= R; k++) { const xx = dir ? x : x + k, yy = dir ? y + k : y; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = (yy * w + xx) * 3; s0 += a[j]; s1 += a[j + 1]; s2 += a[j + 2]; n++; }
      const o = (y * w + x) * 3; b[o] = s0 / n; b[o + 1] = s1 / n; b[o + 2] = s2 / n; }
    a = b; }
  const out = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { out[i * 4] = a[i * 3]; out[i * 4 + 1] = a[i * 3 + 1]; out[i * 4 + 2] = a[i * 3 + 2]; out[i * 4 + 3] = 255; }
  return out;
}

/**
 * Cerca le impostazioni migliori per questa immagine: prova molte combinazioni (a risoluzione ridotta)
 * e misura quanto il risultato somiglia all'originale. Restituisce le 3 migliori, diverse tra loro,
 * con i pezzi, così la pagina può mostrarle (ed eventualmente farle giudicare a Gemini).
 */
function autoImpostazioni(inp, P) {
  const rif = sfoca(inp.rgba, inp.w, inp.h, Math.max(2, Math.round(Math.max(inp.w, inp.h) / 160)));
  const risultati = [];
  const prova = (c) => { const res = segmenta(Object.assign({}, inp, c), () => {}); const r = Object.assign({}, c, { errore: errore(rif, res), pezzi: res.nReg, colori: res.nFine, res }); risultati.push(r); return r; };
  const griglia = []; for (const K of [30, 60, 100, 160, 240]) for (const Kd of [20, 40, 70, 110]) griglia.push({ K, Kd, smooth: 1, seguire: inp.seguire });
  const tot = griglia.length + 3 + (inp.barriera ? 3 : 0); let n = 0;
  const passo = (c) => { P(`Provo le impostazioni: ${++n}/${tot}…`, Math.round(3 + 90 * n / tot)); return prova(c); };
  griglia.forEach(passo);
  const migliore = () => risultati.reduce((a, b) => (b.errore < a.errore ? b : a));
  let m = migliore();
  for (const smooth of [0, 2, 3]) passo({ K: m.K, Kd: m.Kd, smooth, seguire: inp.seguire });
  m = migliore();
  if (inp.barriera) for (const seguire of [40, 75, 95]) passo({ K: m.K, Kd: m.Kd, smooth: m.smooth, seguire });
  const ordinati = risultati.slice().sort((a, b) => a.errore - b.errore), top = [];
  for (const r of ordinati) { if (top.some((t) => t.K === r.K && t.Kd === r.Kd)) continue; top.push(r); if (top.length === 3) break; }
  return { top: top.map((r) => ({ K: r.K, Kd: r.Kd, smooth: r.smooth, seguire: r.seguire, errore: r.errore, pezzi: r.pezzi, colori: r.colori, w: r.res.w, h: r.res.h, reg: r.res.reg, regColor: r.res.regColor, palette: r.res.palette })), prove: risultati.length };
}

if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof window === "undefined") {
  self.onmessage = (e) => {
    if (e.data && e.data.tipo === "auto") {
      try { const t0 = Date.now(); const r = autoImpostazioni(e.data, (msg, pct) => self.postMessage({ tipo: "progresso", msg, pct })); r.ms = Date.now() - t0; self.postMessage({ tipo: "auto", r }, r.top.flatMap((t) => [t.reg.buffer, t.regColor.buffer])); }
      catch (err) { self.postMessage({ tipo: "errore", msg: String((err && err.message) || err) }); }
      return;
    }
    try {
      const t0 = Date.now();
      const res = segmenta(e.data, (msg, pct) => self.postMessage({ tipo: "progresso", msg, pct }));
      res.ms = Date.now() - t0;
      self.postMessage({ tipo: "fatto", res }, [res.reg.buffer, res.regColor.buffer, res.pos.buffer, res.fineLab.buffer, res.linea.buffer]);
    } catch (err) { self.postMessage({ tipo: "errore", msg: String((err && err.message) || err) }); }
  };
}
if (typeof module !== "undefined") module.exports = { segmenta, autoImpostazioni, errore };
