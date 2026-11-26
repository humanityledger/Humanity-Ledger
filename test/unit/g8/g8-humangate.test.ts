import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import {
  analyzeOrbit, analyzeRhythm, evalTargetAt, pathParams, rhythmPulses, leadingZeroBits, cellAt, seededRandom, type Sample,
} from '@/lib/g8/humanGateMath';
import {
  issueChallenge, openChallenge, checkPow, verifyHumanGateSubmission, openReceipt, consumeHumanGateReceipt,
  humanGateRequiredFor, HUMAN_GATE_TTL_SEC, HUMAN_GATE_RECEIPT_TTL_SEC, HG_DIFFICULTY,
} from '@/lib/g8/humanGate';
import { humanGateEnabled } from '@/lib/g8/humanGateClient';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-for-humangate-0123456789';
const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

function solve(seedHex: string, difficulty: number): string {
  for (let n = 0; ; n++) if (leadingZeroBits(createHash('sha256').update(`${seedHex}:${n}`).digest()) >= difficulty) return String(n);
}
/** Box–Muller from a seeded source, so the "human" is reproducible. */
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }

/** A person following the light: ~60 Hz with jitter, reaction lag, tremor and slow drift. */
function human(seedHex: string, opts: { lag?: number; start?: number; dur?: number; noise?: number; dt?: () => number } = {}): Sample[] {
  const p = pathParams(seedHex), r = seededRandom('feed' + seedHex.slice(4));
  const lag = opts.lag ?? 210, noise = opts.noise ?? 0.014;
  const out: Sample[] = [];
  let t = opts.start ?? 900, dx = 0, dy = 0;
  while (t < (opts.start ?? 900) + (opts.dur ?? 2300)) {
    const q = evalTargetAt(p, t - lag);
    dx = dx * 0.92 + gauss(r) * 0.004; dy = dy * 0.92 + gauss(r) * 0.004;
    out.push({ tMs: Math.round(t * 10) / 10, x: q.x + dx + gauss(r) * noise, y: q.y + dy + gauss(r) * noise });
    t += opts.dt ? opts.dt() : 16.7 + gauss(r) * 1.6;
  }
  return out;
}
const SEED = 'a3f1'.repeat(16);

describe('HumanGate math', () => {
  it('path is deterministic, stays on the board, and the grid matches the avatar (10 × 10)', () => {
    const a = pathParams(SEED), b = pathParams(SEED);
    expect(a).toEqual(b);
    for (let t = 0; t < 16000; t += 37) { const q = evalTargetAt(a, t); expect(q.x >= 0.1 && q.x <= 0.9 && q.y >= 0.1 && q.y <= 0.9).toBe(true); }
    expect(cellAt(0.05, 0.05)).toBe(0);
    expect(cellAt(0.99, 0.99)).toBe(99);
    expect(pathParams('b'.repeat(64)).fx[0] === a.fx[0]).toBe(false);
  });

  it('accepts a realistic human trajectory', () => {
    const v = analyzeOrbit(pathParams(SEED), human(SEED));
    expect(v.ok).toBe(true);
    if (v.ok) { expect(v.lagMs >= 150 && v.lagMs <= 270).toBe(true); expect(v.onTarget >= 0.72).toBe(true); }
    for (const seed of ['0'.repeat(63) + '1', 'f'.repeat(64), '7c'.repeat(32)]) expect(analyzeOrbit(pathParams(seed), human(seed)).ok).toBe(true);
  });

  it('rejects synthetic trajectories', () => {
    const p = pathParams(SEED);
    const reason = (s: unknown) => { const v = analyzeOrbit(p, s); return v.ok ? 'ok' : v.reason; };
    expect(reason(human(SEED).slice(0, 10))).toBe('few-samples');
    expect(reason(human(SEED, { dur: 800 }))).toBe('too-fast');
    // straight line at uniform speed
    expect(reason(Array.from({ length: 120 }, (_, i) => ({ tMs: 1000 + i * 16.7 + (i % 3) * 0.3, x: 0.2 + i * 0.005, y: 0.3 + i * 0.004 })))).toMatch(/constant-speed|straight-line/);
    // exact 16 ms metronome
    expect(reason(human(SEED, { dt: () => 16 }))).toBe('metronome');
    // replay of the path with no reaction delay (precognition)
    expect(reason(human(SEED, { lag: 0 }))).toBe('no-reaction-delay');
    // screen-reading agent latency
    expect(reason(human(SEED, { lag: 650 }))).toBe('machine-latency');
    // pixel-perfect replay
    const perfect = human(SEED).map(q => { const t = evalTargetAt(p, q.tMs - 200); return { tMs: q.tMs, x: t.x, y: t.y }; });
    expect(reason(perfect)).toBe('too-perfect');
    // teleport
    const tp = human(SEED); tp[40] = { ...tp[40], x: tp[39].x + 0.7, tMs: tp[39].tMs + 4 };
    expect(reason(tp)).toBe('teleport');
    // following a different board
    expect(reason(human('9d'.repeat(32)))).toMatch(/off-target|no-reaction-delay|machine-latency|never-on-target|too-perfect/);
    expect(reason('nope')).toBe('few-samples');
  });

  it('statistics: varied humans pass, random movement and wrong-board followers do not', () => {
    const r = seededRandom('5eed'.repeat(16));
    const hex = () => Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(r() * 16)]).join('');
    let humans = 0, wander = 0, wrong = 0;
    for (let i = 0; i < 60; i++) {
      const seed = hex();
      if (analyzeOrbit(pathParams(seed), human(seed, { lag: 110 + r() * 280, noise: 0.008 + r() * 0.02, dur: 1800 + r() * 1200, start: 900 + r() * 3000 })).ok) humans++;
      if (analyzeOrbit(pathParams(seed), human(hex(), { start: 900 + r() * 3000 })).ok) wrong++;
      const w: Sample[] = []; let x = 0.5, y = 0.5, vx = 0, vy = 0;
      for (let t = 1000; t < 3500; t += 16.7 + gauss(r) * 1.2) { vx = vx * 0.95 + gauss(r) * 0.03; vy = vy * 0.95 + gauss(r) * 0.03; x = Math.min(0.9, Math.max(0.1, x + vx * 0.05)); y = Math.min(0.9, Math.max(0.1, y + vy * 0.05)); w.push({ tMs: Math.round(t * 10) / 10, x, y }); }
      if (analyzeOrbit(pathParams(seed), w).ok) wander++;
    }
    expect(humans).toBeGreaterThanOrEqual(58);
    expect(wander).toBe(0);
    expect(wrong).toBeLessThanOrEqual(1);
  });

  it('accessible rhythm: human reactions pass, machine-regular or missed pulses fail', () => {
    const p = rhythmPulses(SEED);
    expect(p.length).toBe(4);
    expect(analyzeRhythm(SEED, p.map((v, i) => v + [212, 268, 193, 247][i])).ok).toBe(true);
    expect(analyzeRhythm(SEED, p.map(v => v + 200))).toEqual({ ok: false, reason: 'machine-regular' });
    expect(analyzeRhythm(SEED, [p[0] + 200, p[1] + 230, p[2] + 260, p[3] + 2500])).toEqual({ ok: false, reason: 'missed-pulse' });
    expect(analyzeRhythm(SEED, p.map(v => v + 40))).toEqual({ ok: false, reason: 'missed-pulse' });
  });
});

describe('HumanGate server', () => {
  it('seals challenges: tamper, expiry and a missing secret all fail closed', () => {
    const t0 = 1_800_000_000_000;
    const { token, payload } = issueChallenge('orbit', false, t0);
    expect(openChallenge(token, t0 + 1000)).toEqual(payload);
    expect(payload.difficulty).toBe(HG_DIFFICULTY);
    expect(openChallenge(token.slice(0, -2) + 'xx', t0)).toBeNull();
    const [body, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, difficulty: 12, seedHex: 'b'.repeat(64) })).toString('base64url');
    expect(openChallenge(`${forged}.${sig}`, t0)).toBeNull();
    expect(openChallenge(`${body}.${sig}`, t0 + HUMAN_GATE_TTL_SEC * 1000 + 1)).toBeNull();
    expect(issueChallenge('accessible-rhythm', true, t0).payload.difficulty).toBe(15);
    const saved = process.env.JWT_SECRET; delete process.env.JWT_SECRET;
    try { let threw = false; try { issueChallenge('orbit'); } catch { threw = true; } expect(threw).toBe(true); } finally { process.env.JWT_SECRET = saved; }
  });

  it('proof of work is bound to the challenge seed', () => {
    const n = solve(SEED, 12);
    expect(checkPow(SEED, n, 12)).toBe(true);
    expect(checkPow('b'.repeat(64), n, 12) && checkPow('c'.repeat(64), n, 12)).toBe(false);
    expect(checkPow(SEED, 'abc', 12)).toBe(false);
    expect(checkPow(SEED, '1'.repeat(13), 12)).toBe(false);
  });

  it('full attempt: accepts once, then replay, PoW, events and clock are enforced', async () => {
    const t0 = Date.now();
    const mk = () => { const c = issueChallenge('orbit', false, t0); return { c, sub: { challengeToken: c.token, mode: 'orbit', powNonce: solve(c.payload.seedHex, c.payload.difficulty), samples: human(c.payload.seedHex), trustedRatio: 1 } }; };
    const { sub } = mk();
    const ok = await verifyHumanGateSubmission(sub, { now: t0 + 4000, redis: null });
    expect(ok.ok).toBe(true);
    expect(await verifyHumanGateSubmission(sub, { now: t0 + 4100, redis: null })).toEqual({ ok: false, reason: 'replay' });
    const a = mk(); const bad = String(Number(a.sub.powNonce) + 1); expect(checkPow(a.c.payload.seedHex, bad, 12) || (await verifyHumanGateSubmission({ ...a.sub, powNonce: bad }, { now: t0 + 4000, redis: null })).ok).toBe(false);
    const b = mk(); expect(await verifyHumanGateSubmission({ ...b.sub, trustedRatio: 0.98 }, { now: t0 + 4000, redis: null })).toEqual({ ok: false, reason: 'untrusted-events' });
    const c = mk(); expect(await verifyHumanGateSubmission(c.sub, { now: t0 + 900, redis: null })).toEqual({ ok: false, reason: 'server-clock' });
    const d = mk(); expect(await verifyHumanGateSubmission(d.sub, { now: t0 + 1500, redis: null })).toEqual({ ok: false, reason: 'server-clock' }); // samples end at ~3.2 s
    const e = mk(); expect(await verifyHumanGateSubmission({ ...e.sub, mode: 'accessible-rhythm' }, { now: t0 + 4000, redis: null })).toEqual({ ok: false, reason: 'mode' });
    // Redis says another replica already used it
    const f = mk(); expect(await verifyHumanGateSubmission(f.sub, { now: t0 + 4000, redis: { set: async () => null } })).toEqual({ ok: false, reason: 'replay' });
  });

  it('keyboard mode end to end', async () => {
    const t0 = Date.now();
    const c = issueChallenge('accessible-rhythm', false, t0);
    const pulses = rhythmPulses(c.payload.seedHex);
    const r = await verifyHumanGateSubmission({ challengeToken: c.token, mode: 'accessible-rhythm', powNonce: solve(c.payload.seedHex, 12), presses: pulses.map((v, i) => v + [230, 310, 205, 280][i]), trustedRatio: 1 }, { now: t0 + pulses[3] + 2000, redis: null });
    expect(r.ok).toBe(true);
  });

  it('receipts are sealed, expire and are single use', async () => {
    const t0 = Date.now();
    const c = issueChallenge('orbit', false, t0);
    const r = await verifyHumanGateSubmission({ challengeToken: c.token, mode: 'orbit', powNonce: solve(c.payload.seedHex, 12), samples: human(c.payload.seedHex), trustedRatio: 1 }, { now: t0 + 4000, redis: null });
    if (!r.ok) throw new Error('attempt failed: ' + r.reason);
    const rc = openReceipt(r.receipt, t0 + 5000)!;
    expect(rc.mode).toBe('orbit');
    expect(openReceipt(r.receipt, t0 + 4000 + HUMAN_GATE_RECEIPT_TTL_SEC * 1000 + 1)).toBeNull();
    expect(openReceipt(c.token, t0 + 5000)).toBeNull(); // a challenge is not a receipt
    expect(await consumeHumanGateReceipt(rc, { redis: null })).toBe(true);
    expect(await consumeHumanGateReceipt(rc, { redis: null })).toBe(false);
  });

  it('is required only when the server or the new client flow asks for it; client flag off by default', () => {
    const saved = process.env.HUMAN_GATE_REQUIRED;
    delete process.env.HUMAN_GATE_REQUIRED;
    expect(humanGateRequiredFor({ message: 'x' })).toBe(false);
    expect(humanGateRequiredFor({ humanGateRequired: true })).toBe(true);
    expect(humanGateRequiredFor({ humanGateRequired: 'true' })).toBe(false);
    process.env.HUMAN_GATE_REQUIRED = '1';
    expect(humanGateRequiredFor({})).toBe(true);
    if (saved === undefined) delete process.env.HUMAN_GATE_REQUIRED; else process.env.HUMAN_GATE_REQUIRED = saved;
    expect(humanGateEnabled(undefined)).toBe(false);
    expect(humanGateEnabled('1')).toBe(true);
  });

  it('wiring: routes rate-limit by getClientIP; siwe/verify consumes the receipt before minting', () => {
    for (const f of ['app/api/g8/humangate/challenge/route.ts', 'app/api/g8/humangate/verify/route.ts']) {
      const src = read(f);
      expect(src).toMatch(/checkRateLimit\(getClientIP\(req\)/);
      expect(src).not.toMatch(/x-forwarded-for/);
    }
    const v = read('app/api/siwe/verify/route.ts');
    expect(v.indexOf('consumeHumanGateReceipt(gateReceipt)') > 0 && v.indexOf('consumeHumanGateReceipt(gateReceipt)') < v.indexOf('mintJWT(')).toBe(true);
    expect(read('components/connect/HumanGateCard.tsx')).toMatch(/walletCells\(/);
    expect(read('components/connect/HumanGateCard.tsx')).not.toMatch(/turnstile|hcaptcha|recaptcha|google/i);
  });

  it('copy and security guards pass', () => {
    for (const s of ['scripts/check-forbidden-copy.mjs', 'scripts/forbidden-patterns.mjs']) {
      const r = spawnSync(process.execPath, [s], { cwd: root, encoding: 'utf8' });
      expect(r.status).toBe(0);
    }
  });
});
