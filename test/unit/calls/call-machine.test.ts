/**
 * The call state machine (lib/calls/machine.ts) and the jumps the chat makes today.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { IDLE, TRANSITIONS, canMove, inCall, ringsIn, step, type CallEvent, type CallMachine } from '@/lib/calls/machine';
import { ringMayPlay } from '@/lib/calls/ring-guard';

const run = (...events: CallEvent[]) => events.reduce<CallMachine>((m, e) => step(m, e), IDLE);

describe('call machine', () => {
  it('an outgoing call: dial, answered, media, hang up', () => {
    expect(run('dial').state).toBe('calling');
    expect(run('dial', 'answered').state).toBe('connecting');
    expect(run('dial', 'answered', 'connected').state).toBe('active');
    const end = run('dial', 'answered', 'connected', 'hangup');
    expect(end).toEqual({ state: 'idle', resuming: false, ended: 'hangup' });
  });

  it('an incoming call: ring, answer, media; or missed', () => {
    expect(ringsIn(run('incoming'))).toBe(true);
    expect(inCall(run('incoming', 'accept'))).toBe(true);
    expect(run('incoming', 'missed').ended).toBe('missed');
    expect(run('incoming', 'decline').ended).toBe('declined');
  });

  it('a late signal cannot bring a finished call back or ring during a call', () => {
    const ended = run('dial', 'declined');
    expect(step(ended, 'answered')).toBe(ended);
    expect(step(ended, 'connected')).toBe(ended);
    const live = run('dial', 'answered', 'connected');
    expect(step(live, 'incoming')).toBe(live);
    expect(ringMayPlay(false, live.state)).toBe(false);
  });

  it('a network change keeps the call on while the new connection is made', () => {
    const live = run('incoming', 'accept', 'connected');
    const moving = step(live, 'network-change');
    expect(moving).toEqual({ state: 'active', resuming: true });
    expect(step(moving, 'resumed')).toEqual({ state: 'active', resuming: false });
    expect(step(moving, 'resume-failed')).toEqual({ state: 'active', resuming: false });
    expect(step(moving, 'failed').ended).toBe('failed');
  });

  it('every state can end, and idle only starts calls', () => {
    for (const s of Object.keys(TRANSITIONS) as (keyof typeof TRANSITIONS)[]) {
      if (s !== 'idle') expect(canMove(s, 'idle'), s).toBe(true);
    }
    expect(canMove('idle', 'active')).toBe(false);
    expect(canMove('idle', 'connecting')).toBe(false);
  });

  it('allows every direct change the chat makes', () => {
    const src = readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    expect(src).toMatch(/canMoveCall\(callStateRef\.current, s\)/);
    // the jumps found in the chat today
    expect(canMove('ringing', 'active')).toBe(true);
    expect(canMove('calling', 'active')).toBe(true);
    expect(canMove('calling', 'connecting')).toBe(true);
    expect(canMove('ringing', 'connecting')).toBe(true);
    expect(canMove('connecting', 'active')).toBe(true);
  });
});
