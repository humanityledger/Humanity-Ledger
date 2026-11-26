/**
 * G8 HumanGate — shared math (browser and server compute the same thing).
 *
 * A 10 × 10 mosaic, the same grid as every Ledger Chat avatar (components/chat/WalletGlyph.tsx).
 * A target point glides over it along a path fixed by a server seed: 4 harmonics per axis plus
 * smooth phase kicks every 600–900 ms that bend the path. The person keeps a pointer or finger
 * on the lit square. The server replays the same path from the seed and compares it with the
 * samples (lib/g8/humanGate.ts). It never trusts a client "ok".
 *
 * Pure: no DOM, no Node crypto, no dependencies. Coordinates are normalised to [0, 1].
 */

export const HG_SIDE = 10;
/** Distance (in canvas units) within which the pointer counts as "on" the target: 1.5 squares. */
export const HG_HALO = 0.15;
export const HG_MIN_SAMPLES = 24;
export const HG_MIN_DURATION_MS = 1100;
export const HG_MAX_DURATION_MS = 15_000;
export const HG_MAX_SAMPLES = 2000;
/** Sustained tracking the client asks for before submitting (the arc fills in this time). */
export const HG_HOLD_MS = 1500;
export const HG_SUSTAIN_MS = 1400;
export const HG_ON_TARGET_MIN = 0.72;
export const HG_LAG_MIN_MS = 80;
export const HG_LAG_MAX_MS = 480;
export const HG_LAG_SEARCH_MAX_MS = 700;
/** Velocity correlation between pointer and target over the window (closed loop). */
export const HG_VEL_SPAN_MS = 200;
export const HG_VEL_CORR_MIN = 0.5;
/** Mean distance to the (lagged) light over the window: under ~1 square. */
export const HG_MAX_MEAN_ERR = 0.095;
/** The target must travel at least this far (canvas units) during the scored window. */
export const HG_MIN_TRAVEL = 0.22;
/** Teleport: more than 120 px of a 220 px board in under 8 ms. */
export const HG_TELEPORT_DIST = 120 / 220;
export const HG_TELEPORT_MS = 8;

export type HumanGateMode = 'orbit' | 'accessible-rhythm';

export interface Sample { tMs: number; x: number; y: number }

export interface PathParams {
  ax: number[]; fx: number[]; px: number[];
  ay: number[]; fy: number[]; py: number[];
  kicks: { t: number; axis: 0 | 1; k: number; d: number }[];
}

/** sfc32 seeded from the hex seed: deterministic, identical in every JS engine. */
export function seededRandom(seedHex: string): () => number {
  const h = (seedHex.replace(/^0x/, '') + '0'.repeat(32)).slice(0, 32);
  let a = parseInt(h.slice(0, 8), 16) | 0, b = parseInt(h.slice(8, 16), 16) | 0, c = parseInt(h.slice(16, 24), 16) | 0, d = parseInt(h.slice(24, 32), 16) | 0;
  const next = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

export function pathParams(seedHex: string): PathParams {
  const r = seededRandom(seedHex);
  const amps = () => { const w = [r() + 0.6, r() * 0.8 + 0.3, r() * 0.5 + 0.15, r() * 0.3 + 0.08]; const s = w.reduce((a, b) => a + b, 0); return w.map(v => (v / s) * 0.34); };
  const freqs = () => [0.2 + r() * 0.1, 0.36 + r() * 0.15, 0.57 + r() * 0.18, 0.82 + r() * 0.22];
  const phases = () => [0, 0, 0, 0].map(() => r() * Math.PI * 2);
  const p: PathParams = { ax: amps(), fx: freqs(), px: phases(), ay: amps(), fy: freqs(), py: phases(), kicks: [] };
  let t = 500 + r() * 300;
  while (t < HG_MAX_DURATION_MS + 1000) {
    p.kicks.push({ t, axis: r() < 0.5 ? 0 : 1, k: Math.floor(r() * 4), d: (r() < 0.5 ? -1 : 1) * (1.0 + r() * 0.8) });
    t += 600 + r() * 300;
  }
  return p;
}

const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** Where the target is `tMs` after the board starts moving. */
export function evalTargetAt(p: PathParams, tMs: number): { x: number; y: number } {
  const s = tMs / 1000;
  const kickX = [0, 0, 0, 0], kickY = [0, 0, 0, 0];
  for (const k of p.kicks) {
    if (k.t > tMs) break;
    const v = k.d * smooth((tMs - k.t) / 250);
    (k.axis === 0 ? kickX : kickY)[k.k] += v;
  }
  let x = 0.5, y = 0.5;
  for (let i = 0; i < 4; i++) {
    x += p.ax[i] * Math.sin(2 * Math.PI * p.fx[i] * s + p.px[i] + kickX[i]);
    y += p.ay[i] * Math.sin(2 * Math.PI * p.fy[i] * s + p.py[i] + kickY[i]);
  }
  return { x, y };
}

/** The square (0–99) under a point, as on the avatar grid. */
export function cellAt(x: number, y: number): number {
  const c = Math.min(HG_SIDE - 1, Math.max(0, Math.floor(x * HG_SIDE)));
  const r = Math.min(HG_SIDE - 1, Math.max(0, Math.floor(y * HG_SIDE)));
  return r * HG_SIDE + c;
}

/** Accessible mode: four pulse onsets (ms after start) fixed by the seed. */
export function rhythmPulses(seedHex: string): number[] {
  const r = seededRandom(seedHex + 'a11y');
  const out: number[] = [];
  let t = 900 + r() * 400;
  for (let i = 0; i < 4; i++) { out.push(Math.round(t)); t += 1100 + r() * 700; }
  return out;
}
export const RHYTHM_MIN_REACTION_MS = 120;
export const RHYTHM_MAX_REACTION_MS = 1500;
export const RHYTHM_PULSE_MS = 700;

export type Verdict = { ok: true; lagMs: number; onTarget: number } | { ok: false; reason: string };

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
function stddev(v: number[]) { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); }

/**
 * The kinematic and closed-loop checks (pure; the server adds seal, PoW, clocks and single use).
 * Reasons are stable codes, for tests and telemetry; the UI shows one generic retry message.
 */
export function analyzeOrbit(p: PathParams, raw: unknown): Verdict {
  if (!Array.isArray(raw) || raw.length < HG_MIN_SAMPLES) return { ok: false, reason: 'few-samples' };
  if (raw.length > HG_MAX_SAMPLES) return { ok: false, reason: 'too-many-samples' };
  const s: Sample[] = [];
  for (const q of raw as any[]) {
    const tMs = Number(q?.tMs), x = Number(q?.x), y = Number(q?.y);
    if (![tMs, x, y].every(Number.isFinite) || x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1 || tMs < 0) return { ok: false, reason: 'bad-sample' };
    if (s.length && tMs <= s[s.length - 1].tMs) return { ok: false, reason: 'non-monotonic' };
    s.push({ tMs, x, y });
  }
  const dur = s[s.length - 1].tMs - s[0].tMs;
  if (dur < HG_MIN_DURATION_MS) return { ok: false, reason: 'too-fast' };
  if (dur > HG_MAX_DURATION_MS) return { ok: false, reason: 'too-slow' };

  // Teleports, exact metronome timing, constant speed, straight lines.
  const dts: number[] = [], speeds: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const dt = s[i].tMs - s[i - 1].tMs, d = dist(s[i], s[i - 1]);
    if (dt < HG_TELEPORT_MS && d > HG_TELEPORT_DIST) return { ok: false, reason: 'teleport' };
    dts.push(dt); speeds.push(d / dt);
  }
  if (stddev(dts) < 0.05) return { ok: false, reason: 'metronome' };
  const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  if (meanSpeed <= 0 || stddev(speeds) / meanSpeed < 0.08) return { ok: false, reason: 'constant-speed' };
  { // principal axes: a straight segment has (almost) no spread across its main direction
    const mx = s.reduce((a, q) => a + q.x, 0) / s.length, my = s.reduce((a, q) => a + q.y, 0) / s.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const q of s) { sxx += (q.x - mx) ** 2; syy += (q.y - my) ** 2; sxy += (q.x - mx) * (q.y - my); }
    const tr = (sxx + syy) / s.length, det = (sxx * syy - sxy * sxy) / (s.length ** 2);
    const minor = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
    if (Math.sqrt(Math.max(0, minor)) < 0.006) return { ok: false, reason: 'straight-line' };
  }

  // Closed loop: the pointer follows the target with a human reaction delay.
  let bestLag = 0, bestErr = Infinity;
  for (let L = 0; L <= HG_LAG_SEARCH_MAX_MS; L += 10) {
    let e = 0;
    for (const q of s) e += dist(q, evalTargetAt(p, q.tMs - L));
    if (e < bestErr) { bestErr = e; bestLag = L; }
  }
  const meanErr = bestErr / s.length;
  if (meanErr < 0.004) return { ok: false, reason: 'too-perfect' };
  if (bestLag < HG_LAG_MIN_MS) return { ok: false, reason: 'no-reaction-delay' };
  if (bestLag > HG_LAG_MAX_MS) return { ok: false, reason: 'machine-latency' };

  // Sustained window: from the first sample on target, at least HG_SUSTAIN_MS, ≥72 % on target.
  const on = s.map(q => dist(q, evalTargetAt(p, q.tMs - bestLag)) <= HG_HALO);
  const first = on.indexOf(true);
  if (first < 0) return { ok: false, reason: 'never-on-target' };
  const win = s.slice(first);
  if (win[win.length - 1].tMs - win[0].tMs < HG_SUSTAIN_MS) return { ok: false, reason: 'not-sustained' };
  const share = on.slice(first).filter(Boolean).length / win.length;
  if (share < HG_ON_TARGET_MIN) return { ok: false, reason: 'off-target' };

  // Closed loop proper: being near the light is not enough, the turns must match. Velocities over
  // ~120 ms of pointer and (lagged) target are correlated over the window; the target must also
  // have travelled far enough in it for the comparison to mean something.
  let errWin = 0;
  for (const q of win) errWin += dist(q, evalTargetAt(p, q.tMs - bestLag));
  if (errWin / win.length > HG_MAX_MEAN_ERR) return { ok: false, reason: 'off-target' };
  // Velocities are detrended (window mean removed): two paths drifting the same way for a moment
  // would otherwise correlate by chance; only matching turns count.
  const vp: number[][] = [], vt: number[][] = [];
  for (let i = 0, j = 0; i < win.length; i++) {
    while (j < i && win[i].tMs - win[j].tMs > HG_VEL_SPAN_MS) j++;
    if (j === i || win[i].tMs - win[j].tMs < HG_VEL_SPAN_MS * 0.6) continue;
    const dt = (win[i].tMs - win[j].tMs) / 1000;
    const a0 = evalTargetAt(p, win[j].tMs - bestLag), a1 = evalTargetAt(p, win[i].tMs - bestLag);
    vp.push([(win[i].x - win[j].x) / dt, (win[i].y - win[j].y) / dt]);
    vt.push([(a1.x - a0.x) / dt, (a1.y - a0.y) / dt]);
  }
  const mean = (v: number[][], k: number) => v.reduce((a, b) => a + b[k], 0) / Math.max(1, v.length);
  const mp = [mean(vp, 0), mean(vp, 1)], mt = [mean(vt, 0), mean(vt, 1)];
  let dot = 0, np = 0, nt = 0, travel = 0;
  for (let i = 0; i < vp.length; i++) {
    const px = vp[i][0] - mp[0], py = vp[i][1] - mp[1], tx = vt[i][0] - mt[0], ty = vt[i][1] - mt[1];
    dot += px * tx + py * ty; np += px * px + py * py; nt += tx * tx + ty * ty;
  }
  for (let i = 1; i < win.length; i++) travel += dist(evalTargetAt(p, win[i].tMs - bestLag), evalTargetAt(p, win[i - 1].tMs - bestLag));
  if (travel < HG_MIN_TRAVEL) return { ok: false, reason: 'target-still' };
  const corr = np > 0 && nt > 0 ? dot / Math.sqrt(np * nt) : 0;
  if (corr < HG_VEL_CORR_MIN) return { ok: false, reason: 'not-following' };
  return { ok: true, lagMs: bestLag, onTarget: Math.round(share * 1000) / 1000 };
}

/** Accessible mode: one press per pulse, within a human reaction window, not machine-regular. */
export function analyzeRhythm(seedHex: string, raw: unknown): Verdict {
  if (!Array.isArray(raw) || raw.length < 4 || raw.length > 12) return { ok: false, reason: 'presses' };
  const presses = (raw as unknown[]).map(Number);
  if (!presses.every(Number.isFinite) || presses.some((v, i) => i > 0 && v <= presses[i - 1])) return { ok: false, reason: 'bad-press' };
  const pulses = rhythmPulses(seedHex);
  const reactions: number[] = [];
  for (const on of pulses) {
    const hit = presses.find(v => v - on >= RHYTHM_MIN_REACTION_MS && v - on <= RHYTHM_MAX_REACTION_MS);
    if (hit === undefined) return { ok: false, reason: 'missed-pulse' };
    reactions.push(hit - on);
  }
  if (presses.length > 6) return { ok: false, reason: 'press-spam' };
  if (stddev(reactions) < 6) return { ok: false, reason: 'machine-regular' };
  return { ok: true, lagMs: Math.round(reactions.reduce((a, b) => a + b, 0) / 4), onTarget: 1 };
}

/** Leading zero bits of a byte array (PoW). */
export function leadingZeroBits(bytes: Uint8Array): number {
  let n = 0;
  for (const b of bytes) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; }
  return n;
}
