import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { islandLayout } from '@/lib/activities/priority';
import { toAmount, toDisplayName } from '@/lib/activities/values';
import type { AnyActivity, ProofStep } from '@/lib/activities/types';
import { DEFAULT_STEP_MS, STEP_CAP, expectedStepMs, liveProofProgress, readHistory, recordStepDuration } from '@/lib/activities/proof-timing';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
let t = 1;
const call = (): AnyActivity => ({ id: 'call', kind: 'call', startedAt: t++, attributes: { peer: toDisplayName('Ana'), media: 'audio' }, state: { phase: 'active', micMuted: false, cameraOff: false, remoteVideo: false, connectedAt: 1 } });
const proof = (step: ProofStep): AnyActivity => ({ id: 'proof:1', kind: 'paymentProof', startedAt: t++, attributes: { to: toDisplayName('0x2a91…7c04'), amount: toAmount('25', 'cUSDC')! }, state: { step, updatedAt: t } });
const message = (): AnyActivity => ({ id: 'message:a', kind: 'message', startedAt: t++, attributes: { from: toDisplayName('Leo') }, state: { count: 1 } });
class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }

describe('the island belongs to Ledger Chat', () => {
  it('outside the chat only a live call can show (callOnly)', () => {
    const a = [proof('proving'), message(), call()];
    expect(islandLayout(a, 'island', { callOnly: true }).all.map((x) => x.kind)).toEqual(['call']);
    expect(islandLayout([proof('proving'), message()], 'island', { callOnly: true }).primary).toBeNull();
    expect(islandLayout(a, 'island').all.length).toBe(3);
  });

  it('the layer draws the island only on /chat and /studio, or for a live call; plain toasts elsewhere', () => {
    const layer = read('components/activities/LiveActivityLayer.tsx');
    expect(layer).toMatch(/LEDGER_CHAT_ROUTES = \[\/\^\\\/chat\(\\\/\|\$\)\/, \/\^\\\/studio\(\\\/\|\$\)\/\]/);
    expect(layer).toMatch(/\{\(inChat \|\| liveCall\) && <Island quiet=\{quiet\} callOnly=\{!inChat\} \/>\}/);
    expect(layer).toMatch(/\{inChat \? <ToastBridge \/> : <Toaster /);
    const route = (p: string) => [/^\/chat(\/|$)/, /^\/studio(\/|$)/].some((r) => r.test(p));
    for (const p of ['/chat', '/chat/0xabc', '/studio']) expect(route(p)).toBe(true);
    for (const p of ['/docs', '/docs/overview', '/dashboard', '/terminal', '/', '/connect', '/chatbot', '/whitepaper']) expect(route(p)).toBe(false);
  });
});

describe('live payment ring', () => {
  it('advances inside a step, never reaches the next step on its own, full only when settled', () => {
    const h = {};
    const p0 = liveProofProgress('proving', 0, 0, h);
    const p1 = liveProofProgress('proving', 0, DEFAULT_STEP_MS.proving / 2, h);
    const p2 = liveProofProgress('proving', 0, DEFAULT_STEP_MS.proving * 20, h);
    expect(p0).toBe(1 / 3);
    expect(p1 > p0 && p2 > p1).toBe(true);
    expect(p2 < 2 / 3).toBe(true);
    expect(p2 <= (1 + STEP_CAP) / 3 + 1e-9).toBe(true);
    expect(liveProofProgress('sending', 0, 0, h)).toBe(2 / 3);
    expect(liveProofProgress('settled', 0, 0, h)).toBe(1);
    expect(liveProofProgress('failed', 0, 99_999, h)).toBe(0);
    expect(liveProofProgress('preparing', 1000, 500, h)).toBe(0); // clock skew: never negative
  });

  it('learns this device\'s real step durations (median of the last runs)', () => {
    const s = new Mem() as unknown as Storage;
    expect(expectedStepMs('proving', readHistory(s))).toBe(DEFAULT_STEP_MS.proving);
    for (const ms of [12_000, 14_000, 90_000]) recordStepDuration('proving', ms, s);
    recordStepDuration('settled', 5_000, s); // not a live step
    recordStepDuration('proving', 50, s);    // absurd
    expect(readHistory(s)).toEqual({ proving: [12_000, 14_000, 90_000] });
    expect(expectedStepMs('proving', readHistory(s))).toBe(14_000);
  });
});
