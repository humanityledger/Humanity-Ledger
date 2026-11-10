/**
 * 4.19: a value-moving action runs at most once at a time. React state such
 * as `busy` updates after the next render, so a double tap (common on mobile)
 * or a key repeat can start a second payment or a second funded agreement
 * before the button disables. A synchronous guard drops the second call; it
 * does not queue it.
 */
export function singleFlight() {
  let running = false;
  return async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (running) return undefined;
    running = true;
    try {
      return await fn();
    } finally {
      running = false;
    }
  };
}
