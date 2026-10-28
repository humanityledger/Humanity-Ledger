import { describe, it, expect } from 'vitest';
import { deriveCallLog, callEntryLabel, decodeCallEntry, encodeCallEntry, formatDuration, isCallSignal, type CallSignal } from '@/lib/chat/callLog';

const T = 1_800_000_000_000;
const sig = (id: string, content: string, sec: number, fromMe: boolean): CallSignal =>
  ({ id, content, sentAtMs: T + sec * 1000, fromMe, senderInboxId: fromMe ? 'me' : 'peer' });

describe('deriveCallLog', () => {
  it('an answered call has its duration from answer to hang-up, on both sides', () => {
    const mine = [
      sig('o1', '__CALL_OFFER__:ledgerabc:video', 0, true),
      sig('a1', '__CALL_ANSWER__:ledgerdef', 5, false),
      sig('h1', '__CALL_HANGUP__', 156, false),
    ];
    const theirs = mine.map(s => ({ ...s, fromMe: !s.fromMe }));
    const [me] = deriveCallLog(mine, T + 999_000);
    const [them] = deriveCallLog(theirs, T + 999_000);
    expect(me).toMatchObject({ status: 'answered', durationSec: 151, kind: 'video', callerIsMe: true });
    expect(them).toMatchObject({ status: 'answered', durationSec: 151, callerIsMe: false });
    expect(callEntryLabel(me)).toBe('Outgoing video call');
    expect(callEntryLabel(them)).toBe('Incoming video call');
    expect(formatDuration(151)).toBe('2:31');
  });

  it('caller hangs up before an answer: missed for the callee, no answer for the caller', () => {
    const s = [sig('o', '__CALL_OFFER__:x:audio', 0, false), sig('h', '__CALL_HANGUP__', 20, false)];
    const [e] = deriveCallLog(s, T + 100_000);
    expect(e.status).toBe('missed');
    expect(callEntryLabel(e)).toBe('Missed voice call');
    const [c] = deriveCallLog(s.map(x => ({ ...x, fromMe: true })), T + 100_000);
    expect(callEntryLabel(c)).toBe('Voice call, no answer');
  });

  it('declined before answering', () => {
    const [e] = deriveCallLog([sig('o', '__CALL_OFFER__:x:audio', 0, true), sig('d', '__CALL_DECLINE__', 3, false)]);
    expect(e.status).toBe('declined');
    expect(callEntryLabel(e)).toBe('Voice call declined');
  });

  it('an offer with no follow-up rings for a minute, then counts as missed', () => {
    const s = [sig('o', '__CALL_OFFER__:x:audio', 0, false)];
    expect(deriveCallLog(s, T + 10_000)[0].status).toBe('ringing');
    expect(deriveCallLog(s, T + 61_000)[0].status).toBe('missed');
  });

  it('an answered call without a hang-up is in progress, not missed', () => {
    const s = [sig('o', '__CALL_OFFER__:x:audio', 0, true), sig('a', '__CALL_ANSWER__:y', 4, false)];
    expect(deriveCallLog(s, T + 120_000)[0].status).toBe('ongoing');
  });

  it('a second offer closes the first; repeated and unordered signals give the same log', () => {
    const s = [
      sig('o1', '__CALL_OFFER__:x:audio', 0, true),
      sig('o2', '__CALL_OFFER__:x:audio', 200, true),
      sig('a2', '__CALL_ANSWER__:y', 205, false),
      sig('h2', '__CALL_HANGUP__', 265, true),
    ];
    const a = deriveCallLog(s, T + 900_000);
    const b = deriveCallLog([...s].reverse().concat(s), T + 900_000);
    expect(a).toEqual(b);
    expect(a.map(e => e.status)).toEqual(['missed', 'answered']);
    expect(a[1].durationSec).toBe(60);
  });

  it("the caller's own ANSWER (another of its devices) does not answer the call", () => {
    const s = [sig('o', '__CALL_OFFER__:x:audio', 0, true), sig('a', '__CALL_ANSWER__:y', 2, true), sig('h', '__CALL_HANGUP__', 9, true)];
    expect(deriveCallLog(s, T + 99_000)[0].status).toBe('missed');
  });

  it('ignores signals before any offer, and call-log bubbles themselves', () => {
    expect(deriveCallLog([sig('h', '__CALL_HANGUP__', 0, true)])).toEqual([]);
    expect(isCallSignal('__CALL_LOG__{}')).toBe(false);
  });

  it('round-trips through the bubble encoding', () => {
    const [e] = deriveCallLog([sig('o', '__CALL_OFFER__:x:audio', 0, true), sig('d', '__CALL_DECLINE__', 3, false)]);
    expect(decodeCallEntry(encodeCallEntry(e))).toEqual(e);
    expect(decodeCallEntry('hello')).toBeNull();
  });
});
