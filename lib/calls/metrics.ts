/**
 * lib/calls/metrics.ts
 *
 * Measurements of real calls, kept on this device only (nothing is sent anywhere):
 *   - setupMs:      tap on Call / Answer → the other person's stream arrives
 *   - firstAudioMs: tap on Call / Answer → their voice starts playing
 *   - route, rttMs: direct or through a TURN relay, and the round trip
 *   - resumes:      recoveries after a network change (lib/calls/resume.ts)
 *   - heapMb:       JavaScript memory during the call, every 30 s (Chrome and Edge only)
 *
 * The last 10 calls are in sessionStorage ("hl.call.metrics") and in the console as
 * window.__ledgerCalls, for the two-device checks in docs/CALLS.md.
 */

export interface CallMetrics {
  role: 'caller' | 'callee';
  kind: 'audio' | 'video';
  startedAt: number;
  setupMs?: number;
  firstAudioMs?: number;
  route?: 'direct' | 'relay' | 'unknown';
  rttMs?: number | null;
  resumes: number;
  heapMb: number[];
  endedAt?: number;
}

const KEY = 'hl.call.metrics';
const MAX = 10;

export function startCallMetrics(role: CallMetrics['role'], kind: CallMetrics['kind'], now = Date.now()): CallMetrics {
  return { role, kind, startedAt: now, resumes: 0, heapMb: [] };
}

export function markSetup(m: CallMetrics | null, now = Date.now()) {
  if (m && m.setupMs === undefined) m.setupMs = now - m.startedAt;
}

export function markFirstAudio(m: CallMetrics | null, now = Date.now()) {
  if (m && m.firstAudioMs === undefined) m.firstAudioMs = now - m.startedAt;
}

export function sampleHeap(m: CallMetrics | null, perf: any = typeof performance !== 'undefined' ? performance : null) {
  const used = perf?.memory?.usedJSHeapSize;
  if (m && typeof used === 'number' && m.heapMb.length < 240) m.heapMb.push(Math.round(used / 1_048_576));
}

export function recentCallMetrics(storage: Pick<Storage, 'getItem'> | null = typeof sessionStorage !== 'undefined' ? sessionStorage : null): CallMetrics[] {
  try {
    const v = JSON.parse(storage?.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Ends a call's measurements: kept (last 10) and printed once. Calls that never connected are kept too. */
export function finishCallMetrics(
  m: CallMetrics | null,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  now = Date.now(),
): CallMetrics[] {
  if (!m || m.endedAt) return recentCallMetrics(storage);
  m.endedAt = now;
  const list = [...recentCallMetrics(storage), m].slice(-MAX);
  try {
    storage?.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable */
  }
  if (typeof window !== 'undefined') {
    (window as any).__ledgerCalls = list;
    console.info('[call-metrics]', { setupMs: m.setupMs, firstAudioMs: m.firstAudioMs, route: m.route, rttMs: m.rttMs, resumes: m.resumes, heapMb: m.heapMb.slice(-3) });
  }
  return list;
}
