'use client';
/**
 * The doors into the ActivityManager. Each one turns what the code really knows (the engine's call
 * state, the wallet's payment status, an incoming payment message) into an activity. None of them
 * accepts free text: names go through toDisplayName and amounts through toAmount.
 */
import { useEffect, useRef } from 'react';
import { useActivities } from './store';
import { setOpenAction } from './actions';
import { toAmount, toDisplayName } from './values';
import type { CallPhase, MediaKind, ProofStep, SessionStatus } from './types';

/** The engine's own words for a call (LedgerChatV2's callState). */
export type EngineCallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active';

export interface CallSnapshot {
  engine: EngineCallState;
  reconnecting: boolean;
  peerName: string;
  media: MediaKind;
  /** When the call connected (ms since epoch), or null. */
  connectedAt: number | null;
  micMuted: boolean;
  cameraOff: boolean;
  remoteVideo: boolean;
}

/** How long "Call ended 4:12" stays in the island. */
export const CALL_ENDED_LINGER_MS = 2400;

function phaseOf(s: CallSnapshot): CallPhase | null {
  switch (s.engine) {
    case 'idle': return null;
    case 'calling': return 'outgoing';
    case 'ringing': return 'incoming';
    case 'connecting': return 'connecting';
    case 'active': return s.reconnecting ? 'reconnecting' : 'active';
  }
}

/**
 * Mirrors the engine's call into the single 'call' activity. When the engine goes idle, a call
 * that had connected shows "Call ended" with its length for a moment; one that never connected
 * (declined, cancelled, missed) leaves at once.
 */
export function useCallActivitySync(s: CallSnapshot) {
  const connectedAtRef = useRef<number | null>(null);
  const { peerName, media, engine, reconnecting, connectedAt, micMuted, cameraOff, remoteVideo } = s;
  useEffect(() => {
    const store = useActivities.getState();
    const phase = phaseOf({ engine, reconnecting } as CallSnapshot);
    if (phase === null) {
      const existing = store.activities.find((a) => a.id === 'call');
      if (!existing) return;
      const startedAt = connectedAtRef.current;
      connectedAtRef.current = null;
      if (startedAt) {
        store.end('call', { linger: CALL_ENDED_LINGER_MS, finalState: { phase: 'ended', endedAfter: Math.round((Date.now() - startedAt) / 1000) } });
        // While "ended" lingers the call is drawn by the island, never by the window or stage.
        store.setPresentation('island');
      } else {
        store.dismiss('call');
      }
      return;
    }
    if (connectedAt) connectedAtRef.current = connectedAt;
    // A new call while the last one's "Call ended" still shows: start again on the stage.
    const prev = store.activities.find((a) => a.id === 'call');
    if (prev && prev.kind === 'call' && prev.state.phase === 'ended') store.setPresentation('stage');
    store.start(
      'call',
      { peer: toDisplayName(peerName), media },
      { phase, connectedAt: connectedAt ?? undefined, micMuted, cameraOff, remoteVideo, endedAfter: undefined },
    );
  }, [engine, reconnecting, peerName, media, connectedAt, micMuted, cameraOff, remoteVideo]);
}

/** A voice-note recording, with its own timer. */
export function useRecordingActivitySync(recording: boolean, peerName: string, startedAt: number | null) {
  useEffect(() => {
    const store = useActivities.getState();
    if (recording && startedAt) {
      store.start('recording', { peer: toDisplayName(peerName) }, { startedAt }, { id: 'recording' });
    } else if (store.activities.some((a) => a.id === 'recording')) {
      store.dismiss('recording');
    }
  }, [recording, peerName, startedAt]);
}

/** How long a finished or failed payment stays, and when an abandoned proof is dropped. */
export const PROOF_SETTLED_LINGER_MS = 3000;
export const PROOF_FAILED_LINGER_MS = 9000;
export const PROOF_STALE_MS = 15 * 60_000;

/**
 * A private payment being made on this device, step by step, from the wallet's own status
 * (preparing, proving, sending, settled, failed). `key` is stable for one payment.
 */
export function usePaymentProofActivity(p: { key: string | null; step: ProofStep; toName: string; amount: string; symbol: string }) {
  const { key, step, toName, amount, symbol } = p;
  useEffect(() => {
    if (!key) return;
    const value = toAmount(amount, symbol);
    if (!value) return;
    const store = useActivities.getState();
    const id = `proof:${key}`;
    store.start('paymentProof', { to: toDisplayName(toName), amount: value }, { step, updatedAt: Date.now() }, { id, staleAfter: PROOF_STALE_MS });
    if (step === 'settled') store.end(id, { linger: PROOF_SETTLED_LINGER_MS });
    if (step === 'failed') store.end(id, { linger: PROOF_FAILED_LINGER_MS });
  }, [key, step, toName, amount, symbol]);
}

/** A payment message from someone else: who and how much. Never the message itself. */
export function notifyPaymentReceived(fromName: string, amount: string | number, symbol: string, key?: string) {
  const value = toAmount(String(amount), symbol);
  if (!value) return;
  useActivities.getState().start('paymentReceived', { from: toDisplayName(fromName), amount: value }, { receivedAt: Date.now() }, { id: key ? `received:${key}` : undefined, dismissAfter: 6000 });
}

/**
 * "New message from …": the sender only. Repeated messages from one sender add to its count.
 * `open` runs when the user taps it (open that chat).
 */
export function notifyMessage(fromName: string, open?: () => void) {
  const id = useActivities.getState().start('message', { from: toDisplayName(fromName) }, { count: 1 }, { dismissAfter: 4000 });
  setOpenAction(id, open);
}

/** Sign-in, offline, back online, syncing. */
export function setSessionActivity(status: SessionStatus) {
  const store = useActivities.getState();
  const auto = status === 'online' ? 2000 : status === 'signing-in' ? 3000 : undefined;
  store.start('session', {}, { status }, { dismissAfter: auto });
}

export function clearSessionActivity() {
  useActivities.getState().dismiss('session');
}
