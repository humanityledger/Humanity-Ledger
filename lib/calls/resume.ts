/**
 * lib/calls/resume.ts
 *
 * Keeping a 1:1 call alive across network changes, and switching voice to video, on PeerJS.
 *
 * PeerJS cannot renegotiate a media connection (no `negotiationneeded` handling; an ICE "failed"
 * closes it), so neither an ICE restart nor adding a camera to a running connection is possible.
 * Both are done the same way instead, make-before-break:
 *
 *   1. one side dials a NEW media connection to the other, `metadata.kind = 'resume'`, carrying
 *      its current local stream (with a camera track, for an upgrade);
 *   2. the other side answers it with its own stream, only while a call is active and only from
 *      the same remote identity (same deterministic peer id, a re-registration suffix allowed);
 *   3. when the new connection delivers the remote stream it becomes the call's connection and the
 *      old one is closed. Until then the old one keeps playing, so a working call is never cut.
 *
 * A new connection gathers fresh candidates, which is what a network change needs. DTLS-SRTP, the
 * peer ids and the signalling stay exactly as for a new call.
 */

export interface ResumeMeta {
  kind: 'resume';
  callType: 'audio' | 'video';
  reason: 'network' | 'upgrade';
}

export function isResumeMeta(m: unknown): m is ResumeMeta {
  const x = m as any;
  return !!x && x.kind === 'resume' && (x.callType === 'audio' || x.callType === 'video') && (x.reason === 'network' || x.reason === 'upgrade');
}

/** How long a call may try to recover before it ends. */
export const RESUME_DEADLINE_MS = 25_000;
/** ICE "disconnected" for this long starts a recovery (PeerJS only acts on "failed", much later). */
export const DISCONNECTED_GRACE_MS = 2_500;
/** An attempt under way is left alone this long before a new one replaces it. */
export const RESUME_ATTEMPT_MS = 6_000;
/** Delay before each new attempt; the last value repeats until the deadline. */
export const RESUME_BACKOFF_MS = [0, 1_500, 3_000, 5_000];

export function resumeDelay(attempt: number): number {
  return RESUME_BACKOFF_MS[Math.min(Math.max(0, attempt), RESUME_BACKOFF_MS.length - 1)];
}

/** The deterministic id of an account, without the "-rN" suffix of a re-registration. */
export function basePeerId(id: string | null | undefined): string {
  return String(id ?? '').replace(/-r\d+$/, '');
}

/**
 * Who dials to recover: the caller, unless our own peer id changed during the call (then the other
 * side cannot reach us at the old one, so we dial). Never both by rule; glare is still handled.
 */
export function shouldDialResume(o: { isCaller: boolean; myId: string; myIdAtStart: string }): boolean {
  return o.isCaller || (!!o.myIdAtStart && o.myId !== o.myIdAtStart);
}

/** Both sides dialled at once: the larger peer id keeps its own connection, the other answers. */
export function glareKeepsMine(myId: string, remoteId: string): boolean {
  return myId > remoteId;
}

/** A resume is answered only during a call and only from the person of that call. */
export function acceptResume(o: { callState: string; remoteId: string | null | undefined; fromId: string; hasLocalStream: boolean }): boolean {
  return o.callState === 'active' && !!o.remoteId && o.hasLocalStream && basePeerId(o.fromId) === basePeerId(o.remoteId);
}
