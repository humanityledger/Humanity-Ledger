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
 *  3. Then: a failed payment, an error notice, a recording, a payment being proved, a notice with
 *     progress (a file being sent), a warning, a missed call, a payment received, a notice, a
 *     message, the session. Ties go to the newest.
 *  4. The island draws one primary activity and at most one minimal one beside it; the rest are a
 *     count ("+2") that opens the stack, where every one of them is listed. Nothing is dropped.
 *  5. On quiet routes (landing, sign-in, docs) only a call and notices show: the app's own toasts
 *     must still reach the user there, and nothing else should.
 *  6. The island belongs to Ledger Chat (/chat, /studio). Anywhere else it is not drawn, except a
 *     live call (callOnly), which must stay reachable when the chat is kept alive off /chat.
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
    case 'missedCall':
      return 520;
    case 'notice':
      switch (a.state.tone) {
        case 'error': return 780;
        case 'loading': return 690;
        case 'warning': return 560;
        default: return 450;
      }
  }
}

/** Kinds that still show on a quiet route. */
const QUIET_KINDS: ReadonlySet<AnyActivity['kind']> = new Set(['call', 'notice']);

/** Can the user swipe this away? Not a call, a recording, a proof in flight or "offline". */
export function isDismissible(a: AnyActivity): boolean {
  switch (a.kind) {
    case 'call':
    case 'recording':
      return false;
    case 'paymentProof':
      return a.state.step === 'failed' || a.state.step === 'settled';
    case 'session':
      return a.state.status !== 'offline';
    default:
      return true;
  }
}

export interface IslandLayout {
  primary: AnyActivity | null;
  secondary: AnyActivity | null;
  /** How many more activities wait behind these two. */
  overflow: number;
  /** The primary opens expanded on its own (an incoming call, a failed payment). */
  autoExpand: boolean;
  /** Everything the island may draw, most important first (the stack lists these). */
  all: AnyActivity[];
}

export interface LayoutOptions {
  /** A quiet route: only a call and notices (rule 5). */
  quiet?: boolean;
  /** Outside Ledger Chat: only a live call, so it can be reached or ended (rule 6). */
  callOnly?: boolean;
}

export function islandLayout(activities: readonly AnyActivity[], presentation: CallPresentation, options: LayoutOptions = {}): IslandLayout {
  const ranked = activities
    .filter((a) => !options.quiet || QUIET_KINDS.has(a.kind))
    .filter((a) => !options.callOnly || a.kind === 'call')
    .map((a) => ({ a, r: rank(a, presentation) }))
    .filter((x): x is { a: AnyActivity; r: number } => x.r !== null)
    .sort((x, y) => y.r - x.r || y.a.startedAt - x.a.startedAt);
  const primary = ranked[0]?.a ?? null;
  const secondary = ranked[1]?.a ?? null;
  const autoExpand = !!primary && ((primary.kind === 'call' && primary.state.phase === 'incoming') || (primary.kind === 'paymentProof' && primary.state.step === 'failed'));
  return { primary, secondary, overflow: Math.max(0, ranked.length - 2), autoExpand, all: ranked.map((x) => x.a) };
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
