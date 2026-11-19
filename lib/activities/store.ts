/**
 * ActivityManager: the single store of live activities.
 *
 * Code that runs an activity (the call engine, the wallet, the session) starts it, updates its
 * state and ends it. The island and the floating window only read. Nothing here invents progress:
 * a step changes only when the code doing the work says so.
 *
 * Lifecycle
 *   start(kind, attributes, state, options) -> id
 *     Singletons (call, session) reuse their id: starting a call while one exists updates it.
 *     A message from the same sender adds to its count instead of stacking.
 *   update(id, partialState)
 *   end(id, { linger })   keeps the final state on screen for `linger` ms, then removes it.
 *   dismiss(id)           removes it now (the user swiped or pressed Escape).
 *
 * Timers live here, not in components, so an activity outlives the screen that started it.
 */
import { create } from 'zustand';
import { staleIds } from './priority';
import { clearOpenAction } from './actions';
import type { Activity, ActivityKind, AnyActivity, Attributes, CallPresentation, ContentState } from './types';

/** One instance at a time: starting another updates the first. */
const SINGLETON: Partial<Record<ActivityKind, string>> = { call: 'call', session: 'session' };

export interface StartOptions {
  /** Stable id, for activities the caller wants to update later (a payment's own id). */
  id?: string;
  /** Remove automatically after this many ms (messages, received payments). */
  dismissAfter?: number;
  /** Remove when not updated for this many ms (a proof whose page was closed). */
  staleAfter?: number;
}

interface ActivityStore {
  activities: AnyActivity[];
  presentation: CallPresentation;
  /** The activity the user expanded, or null. */
  expandedId: string | null;
  start<K extends ActivityKind>(kind: K, attributes: Attributes[K], state: ContentState[K], options?: StartOptions): string;
  update<K extends ActivityKind>(id: string, state: Partial<ContentState[K]>, options?: Pick<StartOptions, 'staleAfter'>): void;
  end(id: string, options?: { linger?: number; finalState?: Partial<ContentState[ActivityKind]> }): void;
  dismiss(id: string): void;
  expand(id: string | null): void;
  setPresentation(p: CallPresentation): void;
  /** Drops activities whose staleAt passed. Called by the store's own clock. */
  sweep(now?: number): void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
function schedule(id: string, ms: number, fn: () => void) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => { timers.delete(id); fn(); }, ms));
}
function cancel(id: string) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}

let seq = 0;
const newId = (kind: ActivityKind) => `${kind}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useActivities = create<ActivityStore>((set, get) => ({
  activities: [],
  presentation: 'stage',
  expandedId: null,

  start(kind, attributes, state, options = {}) {
    const now = Date.now();
    const id = options.id ?? SINGLETON[kind] ?? (kind === 'message' ? `message:${(attributes as Attributes['message']).from}` : newId(kind));
    const staleAt = options.staleAfter ? now + options.staleAfter : undefined;
    const existing = get().activities.find((a) => a.id === id);
    let next: AnyActivity;
    if (existing && existing.kind === 'message' && kind === 'message') {
      next = { ...existing, state: { count: existing.state.count + 1 }, startedAt: now } as AnyActivity;
    } else if (existing && existing.kind === kind && !(existing.kind === 'call' && existing.state.phase === 'ended')) {
      // Same activity again (a call that changed phase, a payment re-announced): keep its start.
      next = { ...existing, attributes, state: { ...existing.state, ...state }, staleAt } as AnyActivity;
    } else {
      // New, or a new call over the "Call ended" line of the previous one: nothing carries over.
      next = { id, kind, attributes, state, startedAt: now, staleAt } as Activity as AnyActivity;
    }
    cancel(id);
    set((s) => ({ activities: [...s.activities.filter((a) => a.id !== id), next] }));
    if (options.dismissAfter) schedule(id, options.dismissAfter, () => get().dismiss(id));
    return id;
  },

  update(id, state, options = {}) {
    set((s) => ({
      activities: s.activities.map((a) =>
        a.id === id
          ? ({ ...a, state: { ...a.state, ...state }, staleAt: options.staleAfter ? Date.now() + options.staleAfter : a.staleAt } as AnyActivity)
          : a,
      ),
    }));
  },

  end(id, options = {}) {
    if (options.finalState) get().update(id, options.finalState);
    if (options.linger && options.linger > 0) schedule(id, options.linger, () => get().dismiss(id));
    else get().dismiss(id);
  },

  dismiss(id) {
    cancel(id);
    clearOpenAction(id);
    set((s) => {
      const gone = s.activities.find((a) => a.id === id);
      return {
        activities: s.activities.filter((a) => a.id !== id),
        expandedId: s.expandedId === id ? null : s.expandedId,
        // The next call starts on the stage again.
        presentation: gone?.kind === 'call' ? 'stage' : s.presentation,
      };
    });
  },

  expand(id) {
    set({ expandedId: id });
  },

  setPresentation(p) {
    set((s) => (s.presentation === p ? s : { presentation: p, expandedId: null }));
  },

  sweep(now = Date.now()) {
    for (const id of staleIds(get().activities, now)) get().dismiss(id);
  },
}));

// One clock for staleness, started on first import in the browser.
if (typeof window !== 'undefined') {
  setInterval(() => useActivities.getState().sweep(), 15_000);
}

/** The activity with this id, typed by kind, or undefined. */
export function findActivity<K extends ActivityKind>(kind: K, id: string): Activity<K> | undefined {
  const a = useActivities.getState().activities.find((x) => x.id === id);
  return a && a.kind === kind ? (a as unknown as Activity<K>) : undefined;
}

/** For tests: back to an empty store with no timers. */
export function resetActivities() {
  for (const id of [...timers.keys()]) cancel(id);
  useActivities.setState({ activities: [], presentation: 'stage', expandedId: null });
}
