/** 20 Nov 2026: a ring that went on after the call was answered, and rang again during the call. */
import fs from 'node:fs';
import { busyElsewhere, isAnswerDial, readCallTabsMessage, ringMayPlay, stopsRingHere } from '@/lib/calls/ring-guard';

const A = '0x' + '1'.repeat(40);
const B = '0x' + '2'.repeat(40);

describe('answered or declined on another device', () => {
  const base = { signal: '__CALL_ANSWER__:peer', signalAgeMs: 1000, state: 'ringing' as const, signalPeer: A };
  it('stops the ring for the ringing caller even when another chat is open', () => {
    expect(stopsRingHere({ ...base, ringingPeer: A, openPeer: B })).toBe(true);
    expect(stopsRingHere({ ...base, signal: '__CALL_DECLINE__', ringingPeer: A, openPeer: null })).toBe(true);
  });
  it('does not stop a ring for someone else, a stale signal, or when not ringing', () => {
    expect(stopsRingHere({ ...base, ringingPeer: B, openPeer: A })).toBe(false);
    expect(stopsRingHere({ ...base, ringingPeer: A, openPeer: null, signalAgeMs: 120_000 })).toBe(false);
    expect(stopsRingHere({ ...base, ringingPeer: A, openPeer: null, state: 'active' })).toBe(false);
    expect(stopsRingHere({ ...base, signal: '__CALL_OFFER__:x:video', ringingPeer: A, openPeer: null })).toBe(false);
  });
});

describe('ring and dial guards', () => {
  it('the ring plays only while ringing', () => {
    expect(ringMayPlay(false, 'ringing')).toBe(true);
    for (const s of ['idle', 'calling', 'connecting', 'active'] as const) expect(ringMayPlay(false, s)).toBe(false);
    expect(ringMayPlay(true, 'ringing')).toBe(false);
  });
  it('an answer dial is recognised; a plain call is not', () => {
    expect(isAnswerDial({ kind: 'answer', callType: 'video' })).toBe(true);
    expect(isAnswerDial({ callType: 'video' })).toBe(false);
  });
  it('a window busy with a caller expires', () => {
    const m = new Map([[A, 2000]]);
    expect(busyElsewhere(m, A, 1000)).toBe(true);
    expect(busyElsewhere(m, A, 3000)).toBe(false);
    expect(m.has(A)).toBe(false);
  });
  it('messages from other windows are validated', () => {
    expect(readCallTabsMessage({ t: 'busy', peer: A })).toEqual({ t: 'busy', peer: A });
    expect(readCallTabsMessage({ t: 'busy', peer: 'nope' })).toBeNull();
    expect(readCallTabsMessage({ t: 'ring', peer: A })).toBeNull();
  });
});

describe('wiring in the chat', () => {
  const v2 = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
  it('uses the ringing caller, guards the ring timer, and marks the answer dial', () => {
    expect(v2).toMatch(/ringingPeer: callPeerAddrRef\.current/);
    expect(v2).not.toMatch(/const sameCall = !!msgConvPeer && msgConvPeer\.toLowerCase\(\) === activePeerRef\.current/);
    expect(v2).toMatch(/ringMayPlay\(ringtoneStopped\.current, callStateRef\.current\)/);
    expect(v2).toMatch(/metadata: \{ kind: 'answer', callType: callTypeRef\.current/);
    expect(v2).toMatch(/isAnswerDial\(connection\.metadata\) && callStateRef\.current !== 'calling'/);
    expect(v2).toMatch(/new BroadcastChannel\(CALL_TABS_CHANNEL\)/);
  });
  it('a second ring start tears down the first', () => {
    const start = v2.slice(v2.indexOf('const startRingtone = useCallback'), v2.indexOf('const playRing = () =>'));
    expect(start).toMatch(/clearInterval\(ringtoneRef\.current\)/);
    expect(start).toMatch(/ringtoneCtxRef\.current\.close\(\)/);
  });
});
