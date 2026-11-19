/**
 * What the island shows, decided by pure functions of the activities and the call presentation.
 * No React, no timers: the same input always gives the same layout, and every edge case below
 * has a unit test (test/unit/activities/priority.test.ts).
 *
 * Rules
 *  1. An incoming call outranks everything and opens expanded, unless the chat is on screen with
 *     the call on its stage: then the full-screen ringing screen answers it and the island stays
 *     with the other activities.
 *  2. An active call is in the island only when its presentation is 'island'. In 'window' it is
 *     drawn by the floating window and in 'stage' by the chat, so it is never on screen twice.
 *  3. Then: a failed payment, a recording, a payment being proved, a payment received, a message,
 *     the session. Ties go to the newest.
 *  4. The island draws one primary activity and at most one minimal one beside it; the rest are a
 *     count ("+2"). Nothing is dropped: it waits its turn.
 */
import type { AnyActivity, CallPresentation } from './types';

export function rank(a: AnyActivity, presentation: CallPresentation): number | null {
  switch (a.kind) {
    case 'call': {
      const phase = a.state.phase;
      if (phase === 'incoming') return presentation === 'stage' ? null : 1000;
      if (phase === 'ended') return 300; // the short "Call ended 4:12" line
      // Outgoing and connecting calls show on the stage; once minimised they follow the presentation.
      return presentation === 'island' ? 900 : null;
    }
    case 'paymentProof':
      return a.state.step === 'failed' ? 800 : a.state.step === 'settled' ? 600 : 700;
    case 'recording':
      return 750;
    case 'paymentReceived':
      return 500;
    case 'message':
      return 400;
    case 'session':
      return a.state.status === 'offline' ? 350 : 100;
  }
}

export interface IslandLayout {
  primary: AnyActivity | null;
  secondary: AnyActivity | null;
  /** How many more activities wait behind these two. */
  overflow: number;
  /** The primary opens expanded on its own (an incoming call, a failed payment). */
  autoExpand: boolean;
}

export function islandLayout(activities: readonly AnyActivity[], presentation: CallPresentation): IslandLayout {
  const ranked = activities
    .map((a) => ({ a, r: rank(a, presentation) }))
    .filter((x): x is { a: AnyActivity; r: number } => x.r !== null)
    .sort((x, y) => y.r - x.r || y.a.startedAt - x.a.startedAt);
  const primary = ranked[0]?.a ?? null;
  const secondary = ranked[1]?.a ?? null;
  const autoExpand = !!primary && ((primary.kind === 'call' && primary.state.phase === 'incoming') || (primary.kind === 'paymentProof' && primary.state.step === 'failed'));
  return { primary, secondary, overflow: Math.max(0, ranked.length - 2), autoExpand };
}

/** The call drawn by the floating window, or null. */
export function windowCall(activities: readonly AnyActivity[], presentation: CallPresentation) {
  if (presentation !== 'window') return null;
  const call = activities.find((a): a is Extract<AnyActivity, { kind: 'call' }> => a.kind === 'call');
  if (!call) return null;
  // An incoming call is answered from the island; a call that ended leaves the window at once.
  return call.state.phase === 'incoming' || call.state.phase === 'ended' ? null : call;
}

/** Activities whose staleAt has passed. */
export function staleIds(activities: readonly AnyActivity[], now: number): string[] {
  return activities.filter((a) => a.staleAt !== undefined && a.staleAt <= now).map((a) => a.id);
}
