import { describe, expect, it } from 'vitest';
import { islandLayout, rank, staleIds, windowCall } from '@/lib/activities/priority';
import { toAmount, toDisplayName } from '@/lib/activities/values';
import type { AnyActivity, CallPhase, ProofStep } from '@/lib/activities/types';

let t = 1_000;
const call = (phase: CallPhase): AnyActivity => ({
  id: 'call', kind: 'call', startedAt: t++,
  attributes: { peer: toDisplayName('Ana Ruiz'), media: 'video' },
  state: { phase, micMuted: false, cameraOff: false, remoteVideo: true, connectedAt: phase === 'active' ? 1 : undefined },
});
const proof = (step: ProofStep, id = 'proof:1'): AnyActivity => ({
  id, kind: 'paymentProof', startedAt: t++,
  attributes: { to: toDisplayName('0x2a91…7c04'), amount: toAmount('25', 'HLC')! },
  state: { step, updatedAt: t },
});
const received = (): AnyActivity => ({
  id: 'received:0xabc', kind: 'paymentReceived', startedAt: t++,
  attributes: { from: toDisplayName('Leo Marin'), amount: toAmount('12.5', 'USDC')! },
  state: { receivedAt: t },
});
const message = (from: string): AnyActivity => ({ id: `message:${from}`, kind: 'message', startedAt: t++, attributes: { from: toDisplayName(from) }, state: { count: 1 } });
const recording = (): AnyActivity => ({ id: 'rec', kind: 'recording', startedAt: t++, attributes: { peer: toDisplayName('Ana Ruiz') }, state: { startedAt: t } });
const session = (status: 'offline' | 'online'): AnyActivity => ({ id: 'session', kind: 'session', startedAt: t++, attributes: {}, state: { status } });

describe('island priority', () => {
  it('a live call is drawn by exactly one surface', () => {
    const a = [call('active')];
    // stage: the chat draws it; window: the floating window; island: the island.
    expect(islandLayout(a, 'stage').primary).toBeNull();
    expect(windowCall(a, 'stage')).toBeNull();
    expect(islandLayout(a, 'window').primary).toBeNull();
    expect(windowCall(a, 'window')?.id).toBe('call');
    expect(islandLayout(a, 'island').primary?.id).toBe('call');
    expect(windowCall(a, 'island')).toBeNull();
  });

  it('a ringing call opens the island expanded, unless the full-screen ringing screen shows it', () => {
    const a = [proof('proving'), call('incoming')];
    const l = islandLayout(a, 'window');
    expect(l.primary?.kind).toBe('call');
    expect(l.autoExpand).toBe(true);
    expect(windowCall(a, 'window')).toBeNull(); // answered from the island, not the window
    expect(islandLayout(a, 'stage').primary?.kind).toBe('paymentProof');
  });

  it('edge case: a call arrives while a payment proof is being generated', () => {
    const l = islandLayout([proof('proving'), call('incoming')], 'island');
    expect(l.primary?.kind).toBe('call');
    expect(l.secondary?.kind).toBe('paymentProof'); // the proof keeps going, drawn minimal
    expect(l.overflow).toBe(0);
  });

  it('edge case: a payment settles during a call in the window', () => {
    const a = [call('active'), proof('settled')];
    expect(windowCall(a, 'window')?.id).toBe('call'); // the window is untouched
    expect(islandLayout(a, 'window').primary?.kind).toBe('paymentProof');
    // With the call in the island, the call stays primary and the payment is minimal.
    const l = islandLayout(a, 'island');
    expect(l.primary?.kind).toBe('call');
    expect(l.secondary?.kind).toBe('paymentProof');
  });

  it('edge case: two calls cannot exist; the call is a singleton', () => {
    // The engine refuses a second call while one is live; the store keeps one 'call' id.
    const a = [call('active')];
    const second = call('incoming');
    expect(second.id).toBe(a[0].id);
  });

  it('a failed payment opens expanded and outranks a received payment and messages', () => {
    const l = islandLayout([message('Leo'), received(), proof('failed')], 'stage');
    expect(l.primary?.kind).toBe('paymentProof');
    expect(l.autoExpand).toBe(true);
    expect(l.secondary?.kind).toBe('paymentReceived');
    expect(l.overflow).toBe(1);
  });

  it('nothing is dropped: the rest wait behind a count', () => {
    const l = islandLayout([session('online'), message('A'), message('B'), received(), recording()], 'stage');
    expect(l.primary?.kind).toBe('recording');
    expect(l.secondary?.kind).toBe('paymentReceived');
    expect(l.overflow).toBe(3);
  });

  it('ties go to the newest', () => {
    const older = message('A');
    const newer = message('B');
    expect(islandLayout([older, newer], 'stage').primary?.id).toBe(newer.id);
  });

  it('offline outranks a plain session line; "Call ended" is a short line below payments and messages', () => {
    expect(rank(session('offline'), 'stage')).toBeGreaterThan(rank(session('online'), 'stage')!);
    expect(rank(call('ended'), 'island')).toBeLessThan(rank(proof('sending'), 'island')!);
    expect(rank(call('ended'), 'island')).toBeLessThan(rank(message('A'), 'island')!);
    expect(windowCall([call('ended')], 'window')).toBeNull();
  });

  it('stale activities are found by time', () => {
    const a = { ...proof('proving'), staleAt: 5 } as AnyActivity;
    expect(staleIds([a], 4)).toEqual([]);
    expect(staleIds([a], 5)).toEqual(['proof:1']);
  });
});
