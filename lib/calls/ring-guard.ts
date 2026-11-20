/**
 * When this device may ring, and when it must stop.
 *
 * The bugs this closes (reported 20 Nov 2026):
 *  - The callee answered on one device or window, and another one kept ringing for up to 45 s.
 *    "Answered on another device" only stopped the ring when the caller's chat happened to be the
 *    open one. During the call, the other device's ring could be heard through the microphone.
 *  - A late PeerJS dial from the callee's answer path reached a caller who had already hung up,
 *    and the caller's device rang as if for a new call.
 *  - The ringtone could outlive the ringing state, because its timer only checked a flag.
 */

export const CALL_TABS_CHANNEL = 'ledger-call-v1';
/** A window that is in a call says so this often; others treat it as busy for BUSY_TTL_MS. */
export const BUSY_HEARTBEAT_MS = 10_000;
export const BUSY_TTL_MS = 25_000;

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active';

export type CallTabsMessage =
  | { t: 'busy'; peer: string }
  | { t: 'handled'; peer: string };

const lc = (s: string | null | undefined) => (s || '').toLowerCase();

/**
 * An answer or decline sent from another of our devices stops this device's ring when it is
 * for the call that is ringing: the same caller, whatever chat is open.
 */
export function stopsRingHere(input: {
  signal: string;
  signalAgeMs: number;
  state: CallState;
  signalPeer: string | null | undefined;
  ringingPeer: string | null | undefined;
  openPeer: string | null | undefined;
}): boolean {
  const handled = input.signal.startsWith('__CALL_ANSWER__') || input.signal === '__CALL_DECLINE__';
  if (!handled || input.state !== 'ringing') return false;
  if (!(input.signalAgeMs > -120_000 && input.signalAgeMs < 60_000)) return false;
  const peer = lc(input.signalPeer);
  if (!peer) return false;
  const ringing = lc(input.ringingPeer);
  return ringing ? peer === ringing : peer === lc(input.openPeer);
}

/** A PeerJS dial that answers our call. It never starts a ring. */
export function isAnswerDial(meta: unknown): boolean {
  return !!meta && (meta as { kind?: unknown }).kind === 'answer';
}

/** Whether another window of this browser is in a call with `peer` right now. */
export function busyElsewhere(busy: Map<string, number>, peer: string | null | undefined, now = Date.now()): boolean {
  const p = lc(peer);
  if (!p) return false;
  const until = busy.get(p);
  if (!until) return false;
  if (until <= now) { busy.delete(p); return false; }
  return true;
}

/** Parses a message from another window; anything else is ignored. */
export function readCallTabsMessage(data: unknown): CallTabsMessage | null {
  const d = data as { t?: unknown; peer?: unknown };
  if (!d || (d.t !== 'busy' && d.t !== 'handled') || typeof d.peer !== 'string' || !/^0x[0-9a-f]{40}$/i.test(d.peer)) return null;
  return { t: d.t, peer: d.peer.toLowerCase() };
}

/** The ring plays only while the call is ringing; any other state silences it at the next beat. */
export function ringMayPlay(stopped: boolean, state: CallState): boolean {
  return !stopped && state === 'ringing';
}
