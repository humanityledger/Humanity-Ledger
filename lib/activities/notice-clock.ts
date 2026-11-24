/**
 * When each notice leaves. Like a toast, a notice waits while the user is reading it: while the
 * pointer is over the island or focus is inside it, every countdown stops, and starts again with
 * the time that was left.
 */

interface Entry {
  remaining: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  fn: () => void;
}

const entries = new Map<string, Entry>();
let held = false;

function run(id: string, e: Entry) {
  e.startedAt = Date.now();
  e.timer = setTimeout(() => {
    entries.delete(id);
    e.fn();
  }, e.remaining);
}

/** Calls `fn` after `ms` (Infinity: never), replacing any countdown this id had. */
export function scheduleNotice(id: string, ms: number, fn: () => void) {
  cancelNotice(id);
  if (!Number.isFinite(ms)) return;
  const e: Entry = { remaining: Math.max(0, ms), startedAt: Date.now(), timer: null, fn };
  entries.set(id, e);
  if (!held) run(id, e);
}

export function cancelNotice(id: string) {
  const e = entries.get(id);
  if (e?.timer) clearTimeout(e.timer);
  entries.delete(id);
}

/** Stops (true) or resumes (false) every countdown. */
export function holdNotices(on: boolean) {
  if (on === held) return;
  held = on;
  const now = Date.now();
  for (const [id, e] of entries) {
    if (on) {
      if (e.timer) clearTimeout(e.timer);
      e.timer = null;
      e.remaining = Math.max(0, e.remaining - (now - e.startedAt));
    } else {
      // At least a moment after the pointer leaves, so nothing vanishes under it.
      e.remaining = Math.max(e.remaining, 1200);
      run(id, e);
    }
  }
}

/** For tests. */
export function resetNoticeClock() {
  for (const e of entries.values()) if (e.timer) clearTimeout(e.timer);
  entries.clear();
  held = false;
}
