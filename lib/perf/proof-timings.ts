/**
 * lib/perf/proof-timings.ts — how long proving and sending take on this device (items 21 and 35).
 *
 * The wallet records the time from "start proving" to "sent" for each transaction it makes. The last
 * 20 stay in this browser, never leave it, and give the progress screen an honest expectation
 * ("usually about 38 s on this device") and a way to tell a slow network from a normal wait.
 */

export const TIMINGS_KEY = 'hl.perf.proof_ms.v1';
const KEEP = 20;

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const browserStore = (): Store | undefined => (typeof window === 'undefined' ? undefined : window.localStorage);

export function loadTimings(store: Store | undefined = browserStore()): number[] {
  try {
    const raw = JSON.parse(store?.getItem(TIMINGS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((n) => Number.isFinite(n) && n > 0 && n < 3_600_000) : [];
  } catch {
    return [];
  }
}

export function recordTiming(ms: number, store: Store | undefined = browserStore()): void {
  if (!Number.isFinite(ms) || ms <= 0 || ms >= 3_600_000) return;
  try {
    store?.setItem(TIMINGS_KEY, JSON.stringify([...loadTimings(store), Math.round(ms)].slice(-KEEP)));
  } catch { /* storage full or blocked: timings are a convenience */ }
}

/** Median of the recorded timings, or null with fewer than 3. */
export function typicalMs(timings: readonly number[] = loadTimings()): number | null {
  if (timings.length < 3) return null;
  const s = [...timings].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** True when this attempt is clearly slower than usual on this device (twice the median, and over 30 s). */
export function isSlow(elapsedMs: number, typical: number | null): boolean {
  return typical !== null && elapsedMs > Math.max(2 * typical, 30_000);
}
