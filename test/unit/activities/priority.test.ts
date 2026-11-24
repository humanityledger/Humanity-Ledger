import { describe, expect, it } from 'vitest';
import { isDismissible, islandLayout, rank, staleIds, windowCall } from '@/lib/activities/priority';
import { toAmount, toDisplayName, toNoticeText } from '@/lib/activities/values';
import type { AnyActivity, CallPhase, NoticeText, NoticeTone, ProofStep } from '@/lib/activities/types';

let t = 1_000;
const call = (phase: CallPhase): AnyActivity => ({
  id: 'call', kind: 'call', startedAt: t++,
  attributes: { peer: toDisplayName('Ana Ruiz'), media: 'video' },
  state: { phase, micMuted: false, cameraOff: false, remoteVideo: true, connectedAt: phase === 'active' ? 1 : undefined },
});
const proof = (step: ProofStep, id = 'proof:1'): AnyActivity => ({
  id, kind: 'paymentProof', startedAt: t++,
  attributes: { to: toDisplayName('0x2a91…7c04'), amount: toAmount('25', 'cUSDC')! },
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

const notice = (tone: NoticeTone, id = `notice:${t}`): AnyActivity => ({
  id, kind: 'notice', startedAt: t++, attributes: { source: 'toast' },
  state: { tone, title: toNoticeText('Saved') as NoticeText },
});
const missed = (): AnyActivity => ({
  id: 'missed:Ana Ruiz', kind: 'missedCall', startedAt: t++,
  attributes: { peer: toDisplayName('Ana Ruiz'), media: 'audio' }, state: { count: 1, at: t },
});

describe('island priority: notices and missed calls', () => {
  it('an error notice outranks a recording but never a call or a failed payment', () => {
    const l = islandLayout([recording(), notice('error'), proof('failed'), call('incoming')], 'island');
    expect(l.all.map((a) => a.kind)).toEqual(['call', 'paymentProof', 'notice', 'recording']);
  });

  it('a file being sent sits under a payment being proved; plain notices under money and missed calls', () => {
    expect(rank(notice('loading'), 'stage')).toBeLessThan(rank(proof('proving'), 'stage')!);
    expect(rank(notice('success'), 'stage')).toBeLessThan(rank(received(), 'stage')!);
    expect(rank(notice('success'), 'stage')).toBeLessThan(rank(missed(), 'stage')!);
    expect(rank(notice('success'), 'stage')).toBeGreaterThan(rank(message('A'), 'stage')!);
    expect(rank(notice('warning'), 'stage')).toBeGreaterThan(rank(missed(), 'stage')!);
  });

  it('a missed call outranks a received payment and a message', () => {
    expect(islandLayout([message('Leo'), received(), missed()], 'stage').primary?.kind).toBe('missedCall');
  });

  it('quiet routes show the call and notices, and nothing else', () => {
    const a = [message('Leo'), received(), missed(), session('offline'), notice('info'), call('incoming')];
    const l = islandLayout(a, 'island', { quiet: true });
    expect(l.all.map((x) => x.kind)).toEqual(['call', 'notice']);
    expect(islandLayout([message('Leo')], 'stage', { quiet: true }).primary).toBeNull();
  });

  it('the stack lists everything the island may draw, in order; nothing is dropped', () => {
    const a = [session('online'), message('A'), message('B'), received(), recording(), notice('success')];
    const l = islandLayout(a, 'stage');
    expect(l.all).toHaveLength(a.length);
    expect(l.overflow).toBe(a.length - 2);
    expect(l.all[0]).toBe(l.primary);
    expect(l.all[1]).toBe(l.secondary);
  });

  it('only what is finished or informative can be swiped away', () => {
    expect(isDismissible(call('active'))).toBe(false);
    expect(isDismissible(call('incoming'))).toBe(false);
    expect(isDismissible(recording())).toBe(false);
    expect(isDismissible(proof('proving'))).toBe(false);
    expect(isDismissible(proof('failed'))).toBe(true);
    expect(isDismissible(session('offline'))).toBe(false);
    expect(isDismissible(session('online'))).toBe(true);
    expect(isDismissible(notice('loading'))).toBe(true);
    expect(isDismissible(missed())).toBe(true);
    expect(isDismissible(message('A'))).toBe(true);
  });
});
