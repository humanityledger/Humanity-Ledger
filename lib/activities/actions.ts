/**
 * What tapping an activity does, kept beside the store because callbacks are not serialisable
 * (ActivityKit opens the app with a deep link instead). Removed with the activity.
 */
const open = new Map<string, () => void>();

export function setOpenAction(id: string, fn: (() => void) | undefined) {
  if (fn) open.set(id, fn);
  else open.delete(id);
}

export function runOpenAction(id: string): boolean {
  const fn = open.get(id);
  if (!fn) return false;
  try { fn(); } catch { /* the target screen may be gone */ }
  return true;
}

export function clearOpenAction(id: string) {
  open.delete(id);
}
