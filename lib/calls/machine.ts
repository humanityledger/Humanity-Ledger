/**
 * lib/calls/machine.ts — the states of a 1:1 call and the only ways between them.
 *
 * The call screen, the ring, the island and the call log all read one state (CallState, from
 * ring-guard.ts). This module writes down which events move it where, so a call cannot ring and
 * talk at once, and a late signal cannot bring a finished call back. It is pure: no timers, no
 * PeerJS, no React, and it is drawn in the documentation (/docs/diagrams-messaging, "Call states").
 *
 * A network change does not leave "active": the call is moved make-before-break (resume.ts), so
 * the machine only marks it as `resuming` until the new connection carries the remote stream.
 */
import type { CallState } from './ring-guard';

export type { CallState };

export type CallEvent =
  | 'dial' // you call
  | 'incoming' // they call
  | 'accept' // you answer
  | 'answered' // they answered your call
  | 'connected' // the remote stream arrived
  | 'decline' // you decline
  | 'declined' // they declined
  | 'no-answer' // nobody answered in time
  | 'missed' // the caller gave up, or it was answered on another of your devices
  | 'hangup' // you hang up
  | 'remote-hangup' // they hang up
  | 'failed' // the connection could not be made or was lost
  | 'network-change' // a new connection is being made
  | 'resumed' // the new connection carries the call
  | 'resume-failed'; // the new connection could not be made; the old one still works

export type EndReason = 'declined' | 'no-answer' | 'missed' | 'hangup' | 'remote-hangup' | 'failed';

export interface CallMachine {
  state: CallState;
  /** True while a call is being moved to a new connection; the old one keeps playing. */
  resuming: boolean;
  /** Why the last call ended, once it has. */
  ended?: EndReason;
}

export const IDLE: CallMachine = { state: 'idle', resuming: false };

const ENDS: Partial<Record<CallEvent, EndReason>> = {
  decline: 'declined',
  declined: 'declined',
  'no-answer': 'no-answer',
  missed: 'missed',
  hangup: 'hangup',
  'remote-hangup': 'remote-hangup',
  failed: 'failed',
};

/** Which events each state accepts, and where they lead. */
export const TRANSITIONS: Record<CallState, Partial<Record<CallEvent, CallState>>> = {
  idle: { dial: 'calling', incoming: 'ringing' },
  calling: { answered: 'connecting', connected: 'active', declined: 'idle', 'no-answer': 'idle', hangup: 'idle', failed: 'idle' },
  ringing: { accept: 'connecting', connected: 'active', decline: 'idle', missed: 'idle', 'remote-hangup': 'idle', failed: 'idle' },
  connecting: { connected: 'active', hangup: 'idle', 'remote-hangup': 'idle', failed: 'idle' },
  active: { hangup: 'idle', 'remote-hangup': 'idle', failed: 'idle', 'network-change': 'active', resumed: 'active', 'resume-failed': 'active' },
};

/**
 * The next machine after `event`. An event the state does not accept changes nothing and returns
 * the same object, so callers can compare by identity.
 */
export function step(m: CallMachine, event: CallEvent): CallMachine {
  const to = TRANSITIONS[m.state][event];
  if (to === undefined) return m;
  if (to === 'idle') return { state: 'idle', resuming: false, ended: ENDS[event] };
  if (m.state === 'active' && to === 'active') {
    const resuming = event === 'network-change' ? true : false;
    return resuming === m.resuming ? m : { state: 'active', resuming };
  }
  return { state: to, resuming: false };
}

/** Whether some event moves `from` to `to` (a state set directly is checked against this). */
export function canMove(from: CallState, to: CallState): boolean {
  if (from === to) return true;
  return Object.values(TRANSITIONS[from]).includes(to);
}

/** The ring plays in exactly one state. */
export const ringsIn = (m: CallMachine) => m.state === 'ringing';
/** The call screen with media shows in these. */
export const inCall = (m: CallMachine) => m.state === 'connecting' || m.state === 'active';
