/**
 * Live progress of a private payment for the island's ring (24 fps-free: it is recomputed on the
 * shared one-second clock and the arc eases between values in CSS).
 *
 * The wallet reports steps (preparing → proving → sending → settled); proving on the device and
 * waiting for a block take seconds to minutes, so a ring that moved only on step changes sat still
 * for most of the payment. Inside the current step the ring now advances on this device's own
 * measured durations (an average of its recent payments, defaults until there are some), and it
 * never claims more than it knows:
 *   - a step's own share never fills past STEP_CAP before the wallet reports the next step;
 *   - "settled" is the only state that draws a full ring; "failed" draws none.
 * Storage prefix `hl.island.*` is new (no existing key renamed).
 */
import type { ProofStep } from './types';

export const LIVE_STEPS = ['preparing', 'proving', 'sending'] as const;
export type LiveStep = (typeof LIVE_STEPS)[number];

/** Defaults before this device has measured anything (ms). */
export const DEFAULT_STEP_MS: Record<LiveStep, number> = { preparing: 4_000, proving: 30_000, sending: 36_000 };
/** A step never shows more than this share of itself before the wallet confirms it. */
export const STEP_CAP = 0.9;
const KEY = 'hl.island.proof-steps.v1';
const KEEP = 8;

type History = Partial<Record<LiveStep, number[]>>;

function store(): Storage | undefined {
  try { return typeof window !== 'undefined' ? window.localStorage : undefined; } catch { return undefined; }
}
export function readHistory(s = store()): History {
  try {
    const v = JSON.parse(s?.getItem(KEY) || '{}');
    const out: History = {};
    for (const k of LIVE_STEPS) if (Array.isArray(v?.[k])) out[k] = v[k].filter((n: unknown) => typeof n === 'number' && n > 0 && n < 30 * 60_000).slice(-KEEP);
    return out;
  } catch { return {}; }
}
/** Records how long a finished step took on this device (ignores absurd values). */
export function recordStepDuration(step: ProofStep, ms: number, s = store()): void {
  if (!(LIVE_STEPS as readonly string[]).includes(step) || !(ms > 200) || ms > 30 * 60_000) return;
  const h = readHistory(s);
  const k = step as LiveStep;
  h[k] = [...(h[k] ?? []), Math.round(ms)].slice(-KEEP);
  try { s?.setItem(KEY, JSON.stringify(h)); } catch { /* storage full or blocked: defaults stay */ }
}

/** Expected duration of a step: median of this device's recent runs, else the default. */
export function expectedStepMs(step: LiveStep, h: History = readHistory()): number {
  const xs = [...(h[step] ?? [])].sort((a, b) => a - b);
  if (!xs.length) return DEFAULT_STEP_MS[step];
  const mid = xs.length >> 1;
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * 0..1 for the whole payment. Each live step owns 1/3 of the ring. Inside the current step the
 * share follows an ease-out of elapsed / expected time, capped at STEP_CAP, so it keeps moving
 * (more slowly) if the step runs long, but never reaches the next step on its own.
 */
export function liveProofProgress(step: ProofStep, stepStartedAt: number, now: number, h?: History): number {
  if (step === 'settled') return 1;
  if (step === 'failed') return 0;
  const i = (LIVE_STEPS as readonly string[]).indexOf(step);
  if (i < 0) return 0;
  const expected = expectedStepMs(step as LiveStep, h);
  const t = Math.max(0, now - stepStartedAt) / expected;
  const within = STEP_CAP * (1 - Math.exp(-2.2 * t)); // ~80 % of the cap at the expected time
  return (i + within) / LIVE_STEPS.length;
}
