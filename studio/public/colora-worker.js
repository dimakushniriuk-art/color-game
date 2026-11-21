// Passo 3: sovrappone lo sketch all'immagine reale e trova il colore prevalente
// di ogni zona chiusa dello sketch. Nessuna AI, nessuna rete.
"use strict";

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function srgbToLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function fLab(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
function rgbToLab(r, g, b) {
  r = srgbToLin(r); g = srgbToLin(g); b = srgbToLin(b);
  const x = fLab((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047), y = fLab(0.2126729 * r + 0.7151522 * g + 0.072175 * b), z = fLab((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// ===== ALLINEAMENTO AUTOMATICO =====
// confronta i contorni dell'originale con le linee dello sketch cercando scala e spostamento migliori
function riduci(rgba, W, H, w, h) { // media a blocchi -> luminanza w*h
  const out = new Float32Array(w * h), cnt = new Float32Array(w * h);
  for (let y = 0; y < H; y++) { const yy = Math.min(h - 1, (y * h / H) | 0); for (let x = 0; x < W; x++) { const xx = Math.min(w - 1, (x * w / W) | 0), o = (y * W + x) * 4;
    out[yy * w + xx] += 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]; cnt[yy * w + xx]++; } }
  for (let i = 0; i < w * h; i++) out[i] /= cnt[i]; return out;
}
function sfoca(a, w, h, r) { const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += a[y * w + xx]; n++; } } t[y * w + x] = s / n; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += t[yy * w + x]; n++; } } o[y * w + x] = s / n; }
  return o; }
function bordi(Y, w, h) { const E = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x;
    const gx = Y[i - w + 1] + 2 * Y[i + 1] + Y[i + w + 1] - Y[i - w - 1] - 2 * Y[i - 1] - Y[i + w - 1];
    const gy = Y[i + w - 1] + 2 * Y[i + w] + Y[i + w + 1] - Y[i - w - 1] - 2 * Y[i - w] - Y[i - w + 1];
    E[i] = Math.sqrt(gx * gx + gy * gy); }
  return E; }
function punteggio(E, L, w, h, s, dx, dy) { // correlazione normalizzata tra contorni trasformati e linee
  const ox0 = (w - w * s) / 2 + dx, oy0 = (h - h * s) / 2 + dy; let se = 0, sl = 0, sel = 0, see = 0, sll = 0, n = 0;
  for (let y = 2; y < h - 2; y += 1) { const oy = (y - oy0) / s; if (oy < 0 || oy >= h - 1) continue; const y0 = oy | 0, fy = oy - y0;
    for (let x = 2; x < w - 2; x += 1) { const ox = (x - ox0) / s; if (ox < 0 || ox >= w - 1) continue; const x0 = ox | 0, fx = ox - x0, i = y0 * w + x0;
      const e = (E[i] * (1 - fx) + E[i + 1] * fx) * (1 - fy) + (E[i + w] * (1 - fx) + E[i + w + 1] * fx) * fy, l = L[y * w + x];
      se += e; sl += l; sel += e * l; see += e * e; sll += l * l; n++; } }
  if (n < 100) return -1; const cov = sel / n - (se / n) * (sl / n), ve = see / n - (se / n) ** 2, vl = sll / n - (sl / n) ** 2;
  return cov / Math.sqrt(Math.max(1e-9, ve * vl)); }
function allinea(inp, P) {
  const { sk, orig, W, H } = inp; let best = { s: 1, dx: 0, dy: 0, v: -2 };
  const livelli = [{ lato: 160, sR: [0.90, 1.10, 0.02], dR: 0.07, dStep: 2 }, { lato: 360, sR: [-0.02, 0.02, 0.005], dR: 4, dStep: 1 }];
  livelli.forEach((lv, li) => {
    const k = lv.lato / Math.max(W, H), w = Math.max(16, Math.round(W * k)), h = Math.max(16, Math.round(H * k));
    const E = sfoca(bordi(sfoca(riduci(orig, W, H, w, h), w, h, 1), w, h), w, h, 1);
    const Ls = riduci(sk, W, H, w, h); for (let i = 0; i < w * h; i++) Ls[i] = 255 - Ls[i]; const L = sfoca(Ls, w, h, li === 0 ? 2 : 1);
    P(`Allineamento: livello ${li + 1}/2…`, li * 50);
    if (li === 0) { const dmax = Math.round(lv.dR * w);
      for (let s = lv.sR[0]; s <= lv.sR[1] + 1e-9; s += lv.sR[2]) for (let dy = -dmax; dy <= dmax; dy += lv.dStep) for (let dx = -dmax; dx <= dmax; dx += lv.dStep) {
        const v = punteggio(E, L, w, h, s, dx, dy); if (v > best.v) best = { s, dx: dx / w, dy: dy / h, v }; } }
    else { const c = { ...best }; best.v = -2;
      for (let s = c.s + lv.sR[0]; s <= c.s + lv.sR[1] + 1e-9; s += lv.sR[2]) for (let dy = -lv.dR; dy <= lv.dR; dy += lv.dStep) for (let dx = -lv.dR; dx <= lv.dR; dx += lv.dStep) {
        const DX = c.dx * w + dx, DY = c.dy * h + dy, v = punteggio(E, L, w, h, s, DX, DY); if (v > best.v) best = { s, dx: DX / w, dy: DY / h, v }; } }
  });
  // valore senza correzione, per confronto
  const k = 360 / Math.max(W, H), w = Math.round(W * k), h = Math.round(H * k);
  const E = sfoca(bordi(sfoca(riduci(orig, W, H, w, h), w, h, 1), w, h), w, h, 1); const Ls = riduci(sk, W, H, w, h); for (let i = 0; i < w * h; i++) Ls[i] = 255 - Ls[i];
  const base = punteggio(E, sfoca(Ls, w, h, 1), w, h, 1, 0, 0);
  return { scala: best.s, dx: best.dx, dy: best.dy, qualita: best.v, qualitaIniziale: base };
}

// ===== CHIUSURA DELLE LINEE APERTE =====
function scheletro(m, W, H) { // Zhang-Suen
  const s = m.slice(); let cambiato = true; const del = [];
  const nb = (i) => [s[i - W], s[i - W + 1], s[i + 1], s[i + W + 1], s[i + W], s[i + W - 1], s[i - 1], s[i - W - 1]];
  while (cambiato) { cambiato = false;
    for (let pass = 0; pass < 2; pass++) { del.length = 0;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!s[i]) continue; const p = nb(i);
        const B = p[0] + p[1] + p[2] + p[3] + p[4] + p[5] + p[6] + p[7]; if (B < 2 || B > 6) continue;
        let A = 0; for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) A++; if (A !== 1) continue;
        if (pass === 0 ? (p[0] * p[2] * p[4] === 0 && p[2] * p[4] * p[6] === 0) : (p[0] * p[2] * p[6] === 0 && p[0] * p[4] * p[6] === 0)) del.push(i); }
      if (del.length) { cambiato = true; for (const i of del) s[i] = 0; } } }
  return s; }
function chiudiAperte(linea, W, H, gap) {
  const N = W * H, sk = scheletro(linea, W, H), ponti = new Uint8Array(N);
  const vis = new Int32Array(N).fill(-1); let stamp = 0, nPonti = 0; const q = new Int32Array(N);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = y * W + x; if (!sk[i]) continue;
    let n = 0, ni = -1; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && sk[i + dy * W + dx]) { n++; ni = i + dy * W + dx; }
    if (n !== 1) continue; // non è un'estremità
    // pixel "propri": raggiungibili lungo la linea entro una certa distanza
    stamp++; let qh = 0, qt = 0; const lim = Math.round(gap * 1.6 + 6); const dist = new Map(); q[qt++] = i; vis[i] = stamp; dist.set(i, 0);
    let back = i;
    while (qh < qt) { const p = q[qh++], d = dist.get(p); if (d >= lim) continue; const px = p % W, py = (p / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = px + dx, yy = py + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx;
        if (linea[j] && vis[j] !== stamp) { vis[j] = stamp; dist.set(j, d + 1); q[qt++] = j; if (sk[j] && d + 1 === 7) back = j; } } }
    // direzione della linea all'estremità
    let vx = x - (back % W), vy = y - ((back / W) | 0); const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    let migliore = -1, bs = Infinity;
    for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) { const d = Math.hypot(dx, dy); if (d > gap || d < 1.5) continue;
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (!linea[j] || vis[j] === stamp) continue;
      const c = (dx * vx + dy * vy) / d; if (c < 0.2) continue; const sc = d * (1 + 1.2 * (1 - c)); if (sc < bs) { bs = sc; migliore = j; } }
    if (migliore < 0) continue;
    // traccia il ponte
    const x1 = migliore % W, y1 = (migliore / W) | 0, passi = Math.max(Math.abs(x1 - x), Math.abs(y1 - y));
    for (let t = 0; t <= passi; t++) { const xx = Math.round(x + (x1 - x) * t / passi), yy = Math.round(y + (y1 - y) * t / passi);
      for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) { const j = (yy + oy) * W + xx + ox; if (j < N && !linea[j]) ponti[j] = 1; } }
    nPonti++; }
  return { ponti, nPonti }; }

function colora(inp, P) {
  const { sk, src, W, H } = inp, N = W * H;
  const soglia = inp.soglia || 150, chiusura = inp.chiusura | 0, minArea = Math.max(1, inp.minArea | 0);
  const K = Math.max(2, Math.min(500, inp.K | 0));
  const toni = Math.max(1, Math.min(5, inp.toni | 0 || 1));      // livelli di luce/ombra per zona
  const minTono = Math.max(minArea, inp.minTono | 0 || minArea * 3);

  // 1. linee dello sketch
  P("Lettura delle linee…", 5);
  const linea = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const o = i * 4; if (0.299 * sk[o] + 0.587 * sk[o + 1] + 0.114 * sk[o + 2] < soglia) linea[i] = 1; }
  // collegamento delle estremità aperte alla linea più vicina
  const gap = Math.max(0, inp.gap | 0); let ponti = new Uint8Array(N), nPonti = 0;
  if (gap > 0) { P("Chiusura delle linee aperte…", 10); const r = chiudiAperte(linea, W, H, gap); ponti = r.ponti; nPonti = r.nPonti; for (let i = 0; i < N; i++) if (ponti[i]) linea[i] = 1; }
  // chiusura dei piccoli buchi nelle linee (solo per trovare le zone)
  let chiusa = linea;
  for (let c = 0; c < chiusura; c++) {
    const n = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (chiusa[i] || (x > 0 && chiusa[i - 1]) || (x < W - 1 && chiusa[i + 1]) || (y > 0 && chiusa[i - W]) || (y < H - 1 && chiusa[i + W])) n[i] = 1; }
    chiusa = n;
  }

  // 2. zone chiuse = componenti connesse dei pixel non-linea
  P("Ricerca delle zone chiuse…", 20);
  const reg = new Int32Array(N).fill(-1), stack = new Int32Array(N); const area = []; let R = 0;
  for (let i = 0; i < N; i++) {
    if (chiusa[i] || reg[i] !== -1) continue;
    let sp = 0, a = 0; stack[sp++] = i; reg[i] = R;
    while (sp) { const p = stack[--sp]; a++; const x = p % W;
      if (x > 0 && !chiusa[p - 1] && reg[p - 1] === -1) { reg[p - 1] = R; stack[sp++] = p - 1; }
      if (x < W - 1 && !chiusa[p + 1] && reg[p + 1] === -1) { reg[p + 1] = R; stack[sp++] = p + 1; }
      if (p >= W && !chiusa[p - W] && reg[p - W] === -1) { reg[p - W] = R; stack[sp++] = p - W; }
      if (p < N - W && !chiusa[p + W] && reg[p + W] === -1) { reg[p + W] = R; stack[sp++] = p + W; } }
    area.push(a); R++;
  }
  // zone troppo piccole: trattate come linea
  const nuovo = new Int32Array(R).fill(-1); let R2 = 0; const area2 = [];
  for (let r = 0; r < R; r++) if (area[r] >= minArea) { nuovo[r] = R2++; area2.push(area[r]); }
  for (let i = 0; i < N; i++) if (reg[i] >= 0) reg[i] = nuovo[reg[i]];
  R = R2;

  // 2b. SFUMATURE: ogni zona divisa in "toni" fasce di luminosità (chiaro/medio/scuro…)
  const zonaDi = []; // per ogni regione finale, la zona dello sketch da cui deriva
  let bordoTono = new Uint8Array(N);
  if (toni > 1 && R > 0) {
    P("Analisi di luci e ombre…", 30);
    // luminanza dell'immagine colori, ammorbidita (box blur 2 passate)
    let Y = new Float32Array(N);
    for (let i = 0; i < N; i++) { const o = i * 4; Y[i] = 0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2]; }
    const rB = Math.max(2, Math.round(Math.max(W, H) / 300));
    for (let pass = 0; pass < 2; pass++) {
      const T = new Float32Array(N);
      for (let y = 0; y < H; y++) { let acc = 0, n = 0; for (let x = -rB; x < W; x++) { if (x + rB < W) { acc += Y[y * W + x + rB]; n++; } if (x - rB - 1 >= 0) { acc -= Y[y * W + x - rB - 1]; n--; } if (x >= 0) T[y * W + x] = acc / n; } }
      const U = new Float32Array(N);
      for (let x = 0; x < W; x++) { let acc = 0, n = 0; for (let y = -rB; y < H; y++) { if (y + rB < H) { acc += T[(y + rB) * W + x]; n++; } if (y - rB - 1 >= 0) { acc -= T[(y - rB - 1) * W + x]; n--; } if (y >= 0) U[y * W + x] = acc / n; } }
      Y = U;
    }
    // soglie per zona: fasce uguali tra il 5° e il 95° percentile della luminanza della zona
    const hY = new Uint32Array(R * 64);
    for (let i = 0; i < N; i++) { const r = reg[i]; if (r >= 0) hY[r * 64 + Math.min(63, Y[i] >> 2)]++; }
    const lo = new Float32Array(R), hi = new Float32Array(R);
    for (let r = 0; r < R; r++) { const tot = area2[r]; let c = 0, a = -1, b = -1; for (let k = 0; k < 64; k++) { c += hY[r * 64 + k]; if (a < 0 && c >= tot * 0.05) a = k; if (b < 0 && c >= tot * 0.95) { b = k; break; } } lo[r] = a * 4; hi[r] = (b + 1) * 4; }
    const banda = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) { const r = reg[i]; if (r < 0) continue;
      const rng = hi[r] - lo[r]; // zona quasi uniforme o troppo piccola: un solo tono
      if (rng < 18 || area2[r] < minTono * 2) { banda[i] = 0; continue; }
      const t = (Y[i] - lo[r]) / rng; banda[i] = Math.max(0, Math.min(toni - 1, Math.floor(t * toni))); }
    // bordi delle sfumature più morbidi: maggioranza 5x5 della banda dentro la stessa zona (2 passate)
    for (let pass = 0; pass < 2; pass++) { const nb = banda.slice(); const cnt = new Int32Array(5);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, r = reg[i]; if (r < 0) continue; cnt.fill(0);
        for (let dy = -2; dy <= 2; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -2; dx <= 2; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; const j = yy * W + xx; if (reg[j] === r) cnt[banda[j]]++; } }
        let b = banda[i], bc = cnt[b]; for (let k = 0; k < toni; k++) if (cnt[k] > bc) { bc = cnt[k]; b = k; } nb[i] = b; }
      banda.set(nb); }
    // etichette (zona, banda) -> componenti; fusione delle sotto-zone piccole dentro la stessa zona
    const chiave = new Int32Array(N); for (let i = 0; i < N; i++) chiave[i] = reg[i] < 0 ? -1 : reg[i] * 8 + banda[i];
    const sub = new Int32Array(N);
    for (let it = 0; it < 6; it++) {
      sub.fill(-1); const ar = [], ch = []; let n = 0;
      for (let i = 0; i < N; i++) { if (chiave[i] < 0 || sub[i] !== -1) continue; const c = chiave[i]; let sp = 0, a = 0; stack[sp++] = i; sub[i] = n;
        while (sp) { const p = stack[--sp]; a++; const x = p % W;
          if (x > 0 && sub[p - 1] === -1 && chiave[p - 1] === c) { sub[p - 1] = n; stack[sp++] = p - 1; }
          if (x < W - 1 && sub[p + 1] === -1 && chiave[p + 1] === c) { sub[p + 1] = n; stack[sp++] = p + 1; }
          if (p >= W && sub[p - W] === -1 && chiave[p - W] === c) { sub[p - W] = n; stack[sp++] = p - W; }
          if (p < N - W && sub[p + W] === -1 && chiave[p + W] === c) { sub[p + W] = n; stack[sp++] = p + W; } }
        ar.push(a); ch.push(c); n++; }
      const piccola = new Uint8Array(n); let np = 0; for (let k = 0; k < n; k++) if (ar[k] < minTono) { piccola[k] = 1; np++; }
      if (!np) break;
      const adj = new Map(), add = (a, b) => { if (piccola[a] && (ch[a] >> 3) === (ch[b] >> 3)) { const k = a * n + b; adj.set(k, (adj.get(k) || 0) + 1); } };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, a = sub[i]; if (a < 0) continue;
        if (x < W - 1) { const b = sub[i + 1]; if (b >= 0 && a !== b) { add(a, b); add(b, a); } }
        if (y < H - 1) { const b = sub[i + W]; if (b >= 0 && a !== b) { add(a, b); add(b, a); } } }
      const best = new Int32Array(n).fill(-1), bc = new Float64Array(n);
      for (const [k, c] of adj) { const a = Math.floor(k / n), b = k - a * n; if (c > bc[a]) { bc[a] = c; best[a] = b; } }
      let ch2 = 0; for (let i = 0; i < N; i++) { const a = sub[i]; if (a >= 0 && piccola[a] && best[a] >= 0) { chiave[i] = ch[best[a]]; ch2++; } }
      if (!ch2) break;
    }
    // le sotto-zone diventano le regioni finali
    let n2 = 0; const mappa = new Map(); const area3 = [];
    for (let i = 0; i < N; i++) { if (reg[i] < 0) continue; const s2 = sub[i]; let id = mappa.get(s2); if (id === undefined) { id = n2++; mappa.set(s2, id); area3.push(0); zonaDi.push(reg[i]); } area3[id]++; }
    for (let i = 0; i < N; i++) if (reg[i] >= 0) reg[i] = mappa.get(sub[i]);
    R = n2; area2.length = 0; area3.forEach((a) => area2.push(a));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, a = reg[i]; if (a < 0) continue;
      if ((x < W - 1 && reg[i + 1] >= 0 && reg[i + 1] !== a) || (y < H - 1 && reg[i + W] >= 0 && reg[i + W] !== a)) bordoTono[i] = 1; }
  } else { for (let r = 0; r < R; r++) zonaDi.push(r); }

  // 3. colore prevalente di ogni zona (istogramma 8x8x8, poi media del gruppo vincente)
  P(`Colore prevalente di ${R} zone…`, 40);
  const BIN = 512, hist = new Uint32Array(R * BIN);
  for (let i = 0; i < N; i++) { const r = reg[i]; if (r < 0) continue; const o = i * 4; hist[r * BIN + ((src[o] >> 5) << 6 | (src[o + 1] >> 5) << 3 | (src[o + 2] >> 5))]++; }
  const vinc = new Int32Array(R);
  for (let r = 0; r < R; r++) { let b = 0, bc = -1, o = r * BIN; for (let k = 0; k < BIN; k++) if (hist[o + k] > bc) { bc = hist[o + k]; b = k; } vinc[r] = b; }
  const sr = new Float64Array(R), sg = new Float64Array(R), sb = new Float64Array(R), sn = new Float64Array(R);
  for (let i = 0; i < N; i++) { const r = reg[i]; if (r < 0) continue; const o = i * 4;
    if (((src[o] >> 5) << 6 | (src[o + 1] >> 5) << 3 | (src[o + 2] >> 5)) === vinc[r]) { sr[r] += src[o]; sg[r] += src[o + 1]; sb[r] += src[o + 2]; sn[r]++; } }
  const regRGB = []; for (let r = 0; r < R; r++) regRGB.push([Math.round(sr[r] / sn[r]), Math.round(sg[r] / sn[r]), Math.round(sb[r] / sn[r])]);

  // 4. riduzione a massimo K colori (k-means in Lab pesato per area)
  P("Riduzione della tavolozza…", 60);
  const lab = regRGB.map((c) => rgbToLab(c[0], c[1], c[2]));
  let regColor = new Int32Array(R), palRGB = [], palMatita = null;
  if (inp.matite && inp.matite.length) {
    // ogni zona -> la matita reale più vicina (distanza in Lab); poi massimo K matite, togliendo le meno usate
    const mL = inp.matite.map((c) => rgbToLab(c[0], c[1], c[2]));
    const vicina = (r, attive) => { let b = -1, bd = Infinity; for (const k of attive) { const d = (lab[r][0] - mL[k][0]) ** 2 + (lab[r][1] - mL[k][1]) ** 2 + (lab[r][2] - mL[k][2]) ** 2; if (d < bd) { bd = d; b = k; } } return b; };
    let attive = new Set(mL.map((_, k) => k)); const scelta = new Int32Array(R);
    for (let r = 0; r < R; r++) scelta[r] = vicina(r, attive);
    for (;;) { const ar = new Map(); for (let r = 0; r < R; r++) ar.set(scelta[r], (ar.get(scelta[r]) || 0) + area2[r]);
      attive = new Set(ar.keys()); if (attive.size <= K) break;
      let peg = -1, pa = Infinity; for (const [k, a] of ar) if (a < pa) { pa = a; peg = k; } attive.delete(peg);
      for (let r = 0; r < R; r++) if (scelta[r] === peg) scelta[r] = vicina(r, attive); }
    const usate = [...new Set(scelta)]; const pos = new Map(usate.map((k, j) => [k, j]));
    for (let r = 0; r < R; r++) regColor[r] = pos.get(scelta[r]);
    palRGB = usate.map((k) => inp.matite[k]); palMatita = usate;
  } else if (R <= K) { for (let r = 0; r < R; r++) { regColor[r] = r; palRGB.push(regRGB[r]); } }
  else {
    const rnd = mulberry32(7), C = []; const D = new Float64Array(R).fill(Infinity);
    C.push(lab[Math.floor(rnd() * R)].slice());
    while (C.length < K) {
      let tot = 0; const c = C[C.length - 1];
      for (let r = 0; r < R; r++) { const d = (lab[r][0] - c[0]) ** 2 + (lab[r][1] - c[1]) ** 2 + (lab[r][2] - c[2]) ** 2; if (d < D[r]) D[r] = d; tot += D[r] * area2[r]; }
      if (tot <= 1e-9) break; let x = rnd() * tot, r = 0; for (; r < R - 1; r++) { x -= D[r] * area2[r]; if (x <= 0) break; } C.push(lab[r].slice());
    }
    for (let it = 0; it < 15; it++) {
      const s = C.map(() => [0, 0, 0, 0]);
      for (let r = 0; r < R; r++) { let b = 0, bd = Infinity; for (let k = 0; k < C.length; k++) { const d = (lab[r][0] - C[k][0]) ** 2 + (lab[r][1] - C[k][1]) ** 2 + (lab[r][2] - C[k][2]) ** 2; if (d < bd) { bd = d; b = k; } }
        regColor[r] = b; const w = area2[r]; s[b][0] += lab[r][0] * w; s[b][1] += lab[r][1] * w; s[b][2] += lab[r][2] * w; s[b][3] += w; }
      for (let k = 0; k < C.length; k++) if (s[k][3]) C[k] = [s[k][0] / s[k][3], s[k][1] / s[k][3], s[k][2] / s[k][3]];
    }
    // colore RGB di ogni gruppo = media pesata dei colori prevalenti delle sue zone
    const acc = C.map(() => [0, 0, 0, 0]);
    for (let r = 0; r < R; r++) { const a = acc[regColor[r]], w = area2[r]; a[0] += regRGB[r][0] * w; a[1] += regRGB[r][1] * w; a[2] += regRGB[r][2] * w; a[3] += w; }
    palRGB = acc.map((a) => (a[3] ? [Math.round(a[0] / a[3]), Math.round(a[1] / a[3]), Math.round(a[2] / a[3])] : [255, 255, 255]));
  }
  // numerazione per area (1 = colore più usato), solo colori usati
  const areaCol = new Float64Array(palRGB.length); for (let r = 0; r < R; r++) areaCol[regColor[r]] += area2[r];
  const ord = []; for (let k = 0; k < palRGB.length; k++) if (areaCol[k]) ord.push(k); ord.sort((a, b) => areaCol[b] - areaCol[a]);
  const idx = new Int32Array(palRGB.length).fill(-1); const palette = [], counts = [];
  const matitaIdx = [];
  ord.forEach((k, j) => { idx[k] = j; palette.push(palRGB[k]); counts.push(areaCol[k]); if (palMatita) matitaIdx.push(palMatita[k]); });
  for (let r = 0; r < R; r++) regColor[r] = idx[regColor[r]];

  // 5. pixel di linea/zone piccole -> zona più vicina (per l'immagine colorata piena)
  P("Riempimento sotto le linee…", 75);
  const full = reg.slice(); let q = new Int32Array(N), qn = 0;
  for (let i = 0; i < N; i++) if (full[i] >= 0) q[qn++] = i;
  while (qn) { const nq = new Int32Array(N); let nn = 0;
    for (let k = 0; k < qn; k++) { const p = q[k], x = p % W, r = full[p];
      if (x > 0 && full[p - 1] < 0) { full[p - 1] = r; nq[nn++] = p - 1; }
      if (x < W - 1 && full[p + 1] < 0) { full[p + 1] = r; nq[nn++] = p + 1; }
      if (p >= W && full[p - W] < 0) { full[p - W] = r; nq[nn++] = p - W; }
      if (p < N - W && full[p + W] < 0) { full[p + W] = r; nq[nn++] = p + W; } }
    q = nq; qn = nn; }

  // 6. posizione dei numeri (punto più lontano dalle linee)
  P("Posizione dei numeri…", 88);
  const dist = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, r = reg[i];
    dist[i] = (r < 0 || x === 0 || y === 0 || x === W - 1 || y === H - 1 || reg[i - 1] !== r || reg[i + 1] !== r || reg[i - W] !== r || reg[i + W] !== r) ? 0 : 1e9; }
  for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (dist[i]) dist[i] = Math.min(dist[i], dist[i - 1] + 3, dist[i - W] + 3, dist[i - W - 1] + 4, dist[i - W + 1] + 4); }
  for (let y = H - 2; y >= 0; y--) for (let x = W - 2; x > 0; x--) { const i = y * W + x; if (dist[i]) dist[i] = Math.min(dist[i], dist[i + 1] + 3, dist[i + W] + 3, dist[i + W + 1] + 4, dist[i + W - 1] + 4); }
  const pos = new Float32Array(R * 3);
  for (let i = 0; i < N; i++) { const r = reg[i]; if (r < 0) continue; const d = dist[i] / 3; if (d > pos[r * 3 + 2]) { pos[r * 3] = i % W; pos[r * 3 + 1] = (i / W) | 0; pos[r * 3 + 2] = d; } }

  P("Fatto", 100);
  return { W, H, R, full, linea, ponti, nPonti, bordoTono, matitaIdx, regColor, palette, counts, pos, area: Int32Array.from(area2), zonaDi: Int32Array.from(zonaDi) };
}

if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof window === "undefined") {
  self.onmessage = (e) => {
    if (e.data && e.data.azione === "allinea") { try { self.postMessage({ tipo: "allineato", res: allinea(e.data, (msg, pct) => self.postMessage({ tipo: "progresso", msg, pct })) }); } catch (err) { self.postMessage({ tipo: "errore", msg: String(err.message || err) }); } return; }
    try { const t0 = Date.now(); const res = colora(e.data, (msg, pct) => self.postMessage({ tipo: "progresso", msg, pct })); res.ms = Date.now() - t0;
      self.postMessage({ tipo: "fatto", res }, [res.full.buffer, res.linea.buffer, res.ponti.buffer, res.bordoTono.buffer, res.regColor.buffer, res.pos.buffer, res.area.buffer, res.zonaDi.buffer]); }
    catch (err) { self.postMessage({ tipo: "errore", msg: String((err && err.message) || err) }); }
  };
}
if (typeof module !== "undefined") module.exports = { colora, allinea, chiudiAperte };
