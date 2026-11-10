/**
 * 4.19: a value-moving action runs at most once at a time. React state such
 * as `busy` updates after the next render, so a double tap (common on mobile)
 * or a key repeat can start a second payment or a second funded agreement
 * before the button disables. A synchronous guard drops the second call; it
 * does not queue it.
 */
let active = 0;

/** Value actions started through any singleFlight guard and not yet settled (local data wipe waits for 0). */
export function valueActionsRunning(): number {
  return active;
}

export function singleFlight() {
  let running = false;
  return async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (running) return undefined;
    running = true;
    active++;
    try {
      return await fn();
    } finally {
      running = false;
      active--;
    }
  };
}
