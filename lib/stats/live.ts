/**
 * lib/stats/live.ts — the real numbers behind the live map on the landing page.
 *
 * Nothing here is estimated or seeded:
 *  - accounts   rows in User: every wallet that has signed in to Ledger Chat;
 *  - usernames  rows in ChatUsername: every @username reserved right now;
 *  - visitors   VisitorTally: different browsers per UTC day, located only by the IANA time zone
 *               the browser reports (no IP address, no account, no browser id is stored);
 *  - clones     GitHub's own traffic API for the repository, only when GITHUB_TRAFFIC_TOKEN is set.
 * Counting of visitors started on 18 November 2026; the map says so.
 */
import tzCoords from './tz-coords.json';

export const VISITS_COUNTED_SINCE = '2026-11-18';
const TZ: Record<string, [number, number]> = tzCoords as any;

export function coordsForTimeZone(tz: unknown): [number, number] | null {
  return typeof tz === 'string' && Object.prototype.hasOwnProperty.call(TZ, tz) ? TZ[tz] : null;
}

/** Today in UTC, as YYYY-MM-DD. */
export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export interface LiveRegion {
  tz: string;
  lat: number;
  lon: number;
  visitors: number;
}

export interface LiveStats {
  accounts: number;
  usernames: number;
  visitors: number;
  visitorsToday: number;
  countedSince: string;
  regions: LiveRegion[];
  clones: { count: number; uniques: number; days: number } | null;
  /** Latest Aztec block from the node of the build (node_getBlockNumber); null when the node did not answer. */
  aztecBlock: number | null;
  updatedAt: number;
}

/** Group tallies by time zone into map regions, biggest first. */
export function regionsFrom(rows: Array<{ tz: string; count: number }>, limit = 400): LiveRegion[] {
  const byTz = new Map<string, number>();
  for (const r of rows) byTz.set(r.tz, (byTz.get(r.tz) ?? 0) + r.count);
  const out: LiveRegion[] = [];
  for (const [tz, visitors] of byTz) {
    const c = coordsForTimeZone(tz);
    if (c && visitors > 0) out.push({ tz, lat: c[0], lon: c[1], visitors });
  }
  return out.sort((a, b) => b.visitors - a.visitors).slice(0, limit);
}
