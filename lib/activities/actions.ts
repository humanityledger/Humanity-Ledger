/**
 * What an activity's buttons do, kept beside the store because callbacks are not serialisable
 * (ActivityKit opens the app with a deep link instead). Removed with the activity.
 *
 *   open        tapping the activity itself (open that chat)
 *   callBack    a missed call's "Call back"
 *   action      a notice's action button (the toast's `action`, such as Undo)
 *   cancel      a notice's cancel button (the toast's `cancel`)
 */
export type ActionName = 'open' | 'callBack' | 'action' | 'cancel';

/** Receives the click when there is one (a toast action reads event.preventDefault()). */
type Handler = (event?: unknown) => void;

const handlers = new Map<string, Partial<Record<ActionName, Handler>>>();

export function setAction(id: string, name: ActionName, fn: Handler | undefined) {
  const entry = { ...(handlers.get(id) ?? {}) };
  if (fn) entry[name] = fn;
  else delete entry[name];
  if (Object.keys(entry).length) handlers.set(id, entry);
  else handlers.delete(id);
}

export function hasAction(id: string, name: ActionName): boolean {
  return !!handlers.get(id)?.[name];
}

/** Runs it; false when there is none. A target screen that is gone is not an error. */
export function runAction(id: string, name: ActionName, event?: unknown): boolean {
  const fn = handlers.get(id)?.[name];
  if (!fn) return false;
  try { fn(event); } catch { /* the target screen may be gone */ }
  return true;
}

export function setOpenAction(id: string, fn: (() => void) | undefined) {
  setAction(id, 'open', fn);
}

export function runOpenAction(id: string): boolean {
  return runAction(id, 'open');
}

/** Forgets every action of this activity (called when it is removed). */
export function clearOpenAction(id: string) {
  handlers.delete(id);
}
