/**
 * lib/calls/metrics.ts
 *
 * Measurements of real calls, kept on this device only (nothing is sent anywhere):
 *   - setupMs:      tap on Call / Answer → the other person's stream arrives
 *   - firstAudioMs: tap on Call / Answer → their voice starts playing
 *   - route, rttMs: direct or through a TURN relay, and the round trip
 *   - path:         the candidate type of the selected pair (host, srflx, prflx or relay)
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
  path?: CandidatePath;
  rttMs?: number | null;
  resumes: number;
  heapMb: number[];
  endedAt?: number;
}

export type CandidatePath = 'host' | 'srflx' | 'prflx' | 'relay';

export interface CallRoute {
  kind: 'direct' | 'relay' | 'unknown';
  /** The candidate type that decides the route: relay if either side relays, else the local one. */
  path: CandidatePath | null;
  /** Round trip in 20 ms steps (a jittery number would re-render on every check), or null. */
  rttMs: number | null;
}

const PATHS: CandidatePath[] = ['host', 'srflx', 'prflx', 'relay'];

/**
 * The route of a call from RTCPeerConnection.getStats(): the selected (or nominated, succeeded)
 * candidate pair and its two candidates. Null when no pair has succeeded yet.
 */
export function routeFromStats(stats: { forEach(cb: (r: any) => void): void }): CallRoute | null {
  const candidates: Record<string, any> = {};
  let selectedId: string | null = null;
  let pair: any = null;
  stats.forEach((r: any) => {
    if (r?.type === 'local-candidate' || r?.type === 'remote-candidate') candidates[r.id] = r;
    // Chrome and Safari: transport.selectedCandidatePairId. Firefox: pair.selected.
    if (r?.type === 'transport' && typeof r.selectedCandidatePairId === 'string') selectedId = r.selectedCandidatePairId;
    if (r?.type === 'candidate-pair' && r.state === 'succeeded' && (r.selected || (r.nominated && !pair))) pair = r;
  });
  if (selectedId) {
    stats.forEach((r: any) => { if (r?.type === 'candidate-pair' && r.id === selectedId) pair = r; });
  }
  if (!pair) return null;
  const l = candidates[pair.localCandidateId];
  const r = candidates[pair.remoteCandidateId];
  const lt = PATHS.includes(l?.candidateType) ? (l.candidateType as CandidatePath) : null;
  const rt = PATHS.includes(r?.candidateType) ? (r.candidateType as CandidatePath) : null;
  const path: CandidatePath | null = lt === 'relay' || rt === 'relay' ? 'relay' : lt ?? rt;
  const kind = path === null ? 'unknown' : path === 'relay' ? 'relay' : 'direct';
  const rttMs = typeof pair.currentRoundTripTime === 'number' ? Math.round(pair.currentRoundTripTime * 50) * 20 : null;
  return { kind, path, rttMs };
}

/** Short text for the minimized call: route and how long the call took to connect. */
export function callMetricsLabel(route: Pick<CallRoute, 'path'> | null, m: Pick<CallMetrics, 'setupMs' | 'firstAudioMs'> | null): string {
  const where = route?.path === 'relay' ? 'Relay' : route?.path === 'host' ? 'Local' : route?.path ? 'Direct' : '';
  const secs = (ms?: number) => (typeof ms === 'number' ? `${(ms / 1000).toFixed(1)} s` : '');
  return [where, secs(m?.setupMs)].filter(Boolean).join(' · ');
}

/** Full text for screen readers and the tooltip of the minimized call. */
export function callMetricsDetail(route: Pick<CallRoute, 'path' | 'rttMs'> | null, m: Pick<CallMetrics, 'setupMs' | 'firstAudioMs'> | null): string {
  const parts: string[] = [];
  if (typeof m?.setupMs === 'number') parts.push(`Connected in ${(m.setupMs / 1000).toFixed(1)} s`);
  if (typeof m?.firstAudioMs === 'number') parts.push(`first audio at ${(m.firstAudioMs / 1000).toFixed(1)} s`);
  if (route?.path) parts.push(`route ${route.path === 'relay' ? 'relay (TURN)' : route.path === 'host' ? 'local network (host)' : `direct (${route.path})`}`);
  if (typeof route?.rttMs === 'number') parts.push(`${route.rttMs} ms round trip`);
  return parts.join(', ');
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
    console.info('[call-metrics]', { setupMs: m.setupMs, firstAudioMs: m.firstAudioMs, route: m.route, path: m.path, rttMs: m.rttMs, resumes: m.resumes, heapMb: m.heapMb.slice(-3) });
  }
  return list;
}
