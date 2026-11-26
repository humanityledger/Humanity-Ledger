/** Browser side of G8 HumanGate: flag, challenge, proof of work, submission. No third parties. */
import { leadingZeroBits, type HumanGateMode, type Sample } from '@/lib/g8/humanGateMath';

// Literal process.env access so Next.js inlines it in the client bundle.
export function humanGateEnabled(v: string | undefined = process.env.NEXT_PUBLIC_HUMAN_GATE): boolean {
  return v === '1' || v === 'true';
}

export interface Challenge { challengeToken: string; seedHex: string; mode: HumanGateMode; difficulty: number; ttlSec: number }

export async function fetchChallenge(mode: HumanGateMode, f: typeof fetch = fetch): Promise<Challenge> {
  const r = await f(`/api/g8/humangate/challenge?mode=${mode}`, { cache: 'no-store', credentials: 'include' });
  if (!r.ok) throw new Error(r.status === 429 ? 'rate' : 'unavailable');
  return r.json();
}

async function powInline(seedHex: string, difficulty: number, signal?: AbortSignal): Promise<string> {
  const enc = new TextEncoder();
  for (let n = 0; n < 50_000_000; n++) {
    if (signal?.aborted) throw new Error('aborted');
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${seedHex}:${n}`)));
    if (leadingZeroBits(h) >= difficulty) return String(n);
    if ((n & 1023) === 1023) await new Promise(r => setTimeout(r, 0)); // keep the page responsive
  }
  throw new Error('exhausted');
}

/** Solves the work in a Web Worker (inline fallback when workers are unavailable). */
export function solvePow(seedHex: string, difficulty: number, signal?: AbortSignal): Promise<string> {
  if (typeof Worker === 'undefined') return powInline(seedHex, difficulty, signal);
  return new Promise((resolve, reject) => {
    let w: Worker;
    try { w = new Worker(new URL('./humanGatePow.worker.ts', import.meta.url), { type: 'module' }); }
    catch { powInline(seedHex, difficulty, signal).then(resolve, reject); return; }
    const stop = () => { try { w.terminate(); } catch {} };
    signal?.addEventListener('abort', () => { stop(); reject(new Error('aborted')); }, { once: true });
    w.onmessage = (e: MessageEvent<{ nonce?: string; error?: string }>) => { stop(); e.data.nonce ? resolve(e.data.nonce) : reject(new Error(e.data.error || 'pow')); };
    w.onerror = () => { stop(); powInline(seedHex, difficulty, signal).then(resolve, reject); };
    w.postMessage({ seedHex, difficulty });
  });
}

export interface Attempt { challenge: Challenge; powNonce: string; samples?: Sample[]; presses?: number[]; trustedRatio: number; coalescedCount?: number }

/** Sends one attempt; the server sets the HttpOnly receipt cookie on success. */
export async function submitAttempt(a: Attempt, f: typeof fetch = fetch): Promise<boolean> {
  const r = await f('/api/g8/humangate/verify', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeToken: a.challenge.challengeToken, mode: a.challenge.mode, powNonce: a.powNonce,
      samples: a.samples?.map(s => ({ tMs: Math.round(s.tMs * 10) / 10, x: Math.round(s.x * 1e4) / 1e4, y: Math.round(s.y * 1e4) / 1e4 })),
      presses: a.presses?.map(p => Math.round(p)), trustedRatio: a.trustedRatio, coalescedCount: a.coalescedCount ?? 0,
    }),
  });
  return r.ok && (await r.json().catch(() => null))?.ok === true;
}
