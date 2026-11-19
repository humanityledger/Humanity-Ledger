/**
 * Live round trip from this device to Ledger Chat.
 *
 * The number on screen is measured here, in the browser, on every visit.
 * It is not the browser's estimated round-trip hint. That hint is missing
 * on iOS and Firefox, and where it exists it is rounded to 25 ms or 50 ms
 * steps. This is not a server guess either.
 *
 * The preferred reading is the Resource Timing gap from the request leaving
 * the browser until the first response byte. That is the round trip itself,
 * so a phone and a computer on the same network report the same path instead
 * of the slower device's main thread. When a browser records those fields as
 * 0 (some iOS responses do), the fallback is the performance.now() span of
 * the same probe, with a one-off TLS handshake removed so it stays comparable
 * to the next probe on the warm connection.
 *
 * The shown value is that duration rounded to the nearest millisecond.
 * Nothing averages it and nothing snaps it to a bucket.
 */

export const GOOD_UNDER_MS = 150;
export const SLOW_UNDER_MS = 400;
export const PROBE_INTERVAL_MS = 1500;
export const PROBE_TIMEOUT_MS = 8000;

export type LatencyQuality = 'good' | 'mid' | 'bad' | 'unknown';

export type LiveRttSample = {
  ms: number | null;
  quality: LatencyQuality;
  offline: boolean;
};

export type TimingEntry = {
  name: string;
  startTime: number;
  requestStart: number;
  responseStart: number;
  connectStart: number;
  connectEnd: number;
};

export function qualityForMs(ms: number): Exclude<LatencyQuality, 'unknown'> {
  if (ms < GOOD_UNDER_MS) return 'good';
  if (ms < SLOW_UNDER_MS) return 'mid';
  return 'bad';
}

export function qualityLabel(quality: LatencyQuality): string {
  if (quality === 'good') return 'good';
  if (quality === 'mid') return 'medium';
  if (quality === 'bad') return 'poor';
  return 'measuring';
}

/**
 * Integer milliseconds for one probe.
 * `netMs` wins when it is a real first-byte gap and it fits inside the wait
 * the client just recorded. Otherwise the wait itself is used, minus a
 * handshake that only this probe paid.
 */
export function exactClientMs(args: {
  wallMs: number;
  netMs: number | null;
  handshakeMs: number | null;
}): number {
  const wall = args.wallMs;
  if (!Number.isFinite(wall) || wall < 0) return 0;
  const net = args.netMs;
  if (net != null && Number.isFinite(net) && net > 0 && net <= wall + 1) {
    return Math.round(net);
  }
  let fallback = wall;
  const handshake = args.handshakeMs;
  if (handshake != null && Number.isFinite(handshake) && handshake > 0 && handshake < wall) {
    fallback = wall - handshake;
  }
  return Math.max(0, Math.round(fallback));
}

/** The Resource Timing row for this probe, ignoring older pings still in the buffer. */
export function matchingEntry(entries: TimingEntry[], url: string, startedAt: number): TimingEntry | null {
  const path = url.includes('/api/ping') ? url.slice(url.indexOf('/api/ping')) : url;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.name !== url && !entry.name.endsWith(path)) continue;
    if (entry.startTime + 5 < startedAt) continue;
    return entry;
  }
  return null;
}

export function timingFromEntry(entry: TimingEntry | null): { netMs: number | null; handshakeMs: number | null } {
  if (!entry) return { netMs: null, handshakeMs: null };
  const net = entry.responseStart - entry.requestStart;
  const netMs = entry.requestStart > 0 && entry.responseStart > entry.requestStart && net > 0 ? net : null;
  const handshake = entry.connectEnd - entry.connectStart;
  const handshakeMs = entry.connectStart > 0 && entry.connectEnd > entry.connectStart && handshake > 0 ? handshake : null;
  return { netMs, handshakeMs };
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export async function measurePing(opts?: {
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
  now?: () => number;
  readEntries?: () => TimingEntry[];
}): Promise<{ ms: number | null }> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const now = opts?.now ?? (() => performance.now());
  const readEntries = opts?.readEntries ?? (() => {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return [];
    return performance.getEntriesByType('resource') as TimingEntry[];
  });
  const path = `/api/ping?n=${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const startedAt = now();
  let res: Response;
  try {
    res = await fetchImpl(path, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'manual',
      signal: opts?.signal,
    });
  } catch {
    return { ms: null };
  }
  try {
    await res.arrayBuffer();
  } catch {
    return { ms: null };
  }
  // A redirect or an error page is not a completed probe. Keep the last exact reading.
  if (!res.ok || res.type === 'opaqueredirect') return { ms: null };
  const wallMs = now() - startedAt;
  const name = res.url && res.url.includes('/api/ping') ? res.url : path;
  const { netMs, handshakeMs } = timingFromEntry(matchingEntry(readEntries(), name, startedAt));
  return { ms: exactClientMs({ wallMs, netMs, handshakeMs }) };
}

const INITIAL: LiveRttSample = { ms: null, quality: 'unknown', offline: false };

let sample: LiveRttSample = INITIAL;
const listeners = new Set<(s: LiveRttSample) => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let inflight: AbortController | null = null;
let gen = 0;

function publish(next: LiveRttSample) {
  sample = next;
  for (const listener of listeners) listener(next);
}

function arm(delay: number, token: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void tick(token); }, delay);
}

function kick() {
  if (!running) return;
  if (timer) clearTimeout(timer);
  timer = null;
  void tick(gen);
}

async function tick(token: number) {
  if (!running || token !== gen || inflight) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    publish({ ms: null, quality: 'bad', offline: true });
    arm(PROBE_INTERVAL_MS, token);
    return;
  }
  const ctrl = new AbortController();
  inflight = ctrl;
  const timeout = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const result = await measurePing({ signal: ctrl.signal });
    if (!running || token !== gen) return;
    if (result.ms == null) {
      // No new reading. Keep the last exact millisecond. Only "offline" clears it.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        publish({ ms: null, quality: 'bad', offline: true });
      }
    } else {
      publish({ ms: result.ms, quality: qualityForMs(result.ms), offline: false });
    }
  } finally {
    clearTimeout(timeout);
    if (inflight === ctrl) inflight = null;
    if (running && token === gen && (typeof document === 'undefined' || document.visibilityState !== 'hidden')) {
      arm(PROBE_INTERVAL_MS, token);
    }
  }
}

function onOffline() {
  publish({ ms: null, quality: 'bad', offline: true });
}

export function subscribeLiveRtt(listener: (s: LiveRttSample) => void): () => void {
  listeners.add(listener);
  listener(sample);
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (!running && typeof window !== 'undefined') {
    running = true;
    const token = ++gen;
    window.addEventListener('online', kick);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', kick);
    if (document.visibilityState !== 'hidden') void tick(token);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (stopTimer) clearTimeout(stopTimer);
    // React Strict Mode unmounts and remounts at once. Wait before tearing the probe down.
    stopTimer = setTimeout(() => {
      stopTimer = null;
      if (listeners.size > 0) return;
      running = false;
      gen += 1;
      if (timer) clearTimeout(timer);
      timer = null;
      inflight?.abort();
      inflight = null;
      window.removeEventListener('online', kick);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', kick);
    }, 50);
  };
}

/** Test hook. Production code never resets a live session this way. */
export function resetLiveRttForTests() {
  running = false;
  gen += 1;
  if (timer) clearTimeout(timer);
  timer = null;
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  inflight?.abort();
  inflight = null;
  listeners.clear();
  sample = INITIAL;
}
