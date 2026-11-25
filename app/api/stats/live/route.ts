/**
 * GET /api/stats/live — the numbers on the landing page's live map (lib/stats/live.ts).
 * Computed from the database at most every 10 s and shared by every visitor through Redis.
 */
import { NextResponse } from 'next/server';
import * as prismaModule from '@/lib/prisma';
import { safeRedisGet, safeRedisSet } from '@/lib/redis';
import { readBlockNumber } from '@/lib/protocol/read';
import { regionsFrom, utcDay, VISITS_COUNTED_SINCE, type LiveStats } from '@/lib/stats/live';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'stats:live:v1';
const CLONES_KEY = 'stats:github-clones:v1';
const L1_TTL_MS = 5_000;

let l1StatsJson: { expiresAt: number; json: string } | null = null;
let inFlightStats: Promise<string> | null = null;

function getStatsReadDb() {
  return Object.prototype.hasOwnProperty.call(prismaModule, 'prismaRead')
    ? (prismaModule as { prismaRead?: typeof prismaModule.prisma }).prismaRead ?? prismaModule.prisma
    : prismaModule.prisma;
}

const LIVE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=5, s-maxage=10, stale-while-revalidate=20',
  'CDN-Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
};

async function githubClones(): Promise<LiveStats['clones']> {
  const token = process.env.GITHUB_TRAFFIC_TOKEN;
  if (!token) return null;
  const cached = await safeRedisGet(CLONES_KEY);
  if (cached && cached !== 'TIMEOUT') {
    try { return JSON.parse(cached); } catch { /* fetch again */ }
  }
  try {
    const res = await fetch('https://api.github.com/repos/humanityledger/Humanity-Ledger/traffic/clones', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const out = { count: Number(d.count) || 0, uniques: Number(d.uniques) || 0, days: Array.isArray(d.clones) ? d.clones.length : 14 };
    await safeRedisSet(CLONES_KEY, JSON.stringify(out), 'EX', 3600);
    return out;
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();
  if (process.env.NODE_ENV !== 'test' && l1StatsJson && now < l1StatsJson.expiresAt) {
    return new NextResponse(l1StatsJson.json, { headers: LIVE_HEADERS });
  }

  const cached = await safeRedisGet(CACHE_KEY);
  if (cached && cached !== 'TIMEOUT') {
    l1StatsJson = { expiresAt: Date.now() + L1_TTL_MS, json: cached };
    return new NextResponse(cached, { headers: LIVE_HEADERS });
  }

  try {
    if (!inFlightStats) {
      inFlightStats = (async () => {
        const dbRead = getStatsReadDb();
        const today = utcDay();
        const [accounts, usernames, rows, todayRows, clones, aztecBlock] = await Promise.all([
          dbRead.user.count(),
          dbRead.chatUsername.count().catch(() => 0),
          dbRead.visitorTally.groupBy({ by: ['tz'], _sum: { count: true } }).catch(() => [] as any[]),
          dbRead.visitorTally.aggregate({ where: { day: today }, _sum: { count: true } }).catch(() => null),
          githubClones(),
          readBlockNumber(),
        ]);
        const tallies = (rows as any[]).map((r) => ({ tz: r.tz as string, count: Number(r._sum?.count) || 0 }));
        const stats: LiveStats = {
          accounts,
          usernames,
          visitors: tallies.reduce((n, r) => n + r.count, 0),
          visitorsToday: Number(todayRows?._sum?.count) || 0,
          countedSince: VISITS_COUNTED_SINCE,
          regions: regionsFrom(tallies),
          clones,
          aztecBlock,
          updatedAt: Date.now(),
        };
        const json = JSON.stringify(stats);
        l1StatsJson = { expiresAt: Date.now() + L1_TTL_MS, json };
        await safeRedisSet(CACHE_KEY, json, 'EX', 10);
        return json;
      })().finally(() => {
        inFlightStats = null;
      });
    }
    const json = await inFlightStats;
    return new NextResponse(json, { headers: LIVE_HEADERS });
  } catch (e) {
    console.warn('[stats/live] unavailable:', (e as { code?: string })?.code ?? (e as Error)?.message);
    return NextResponse.json({ error: 'Live numbers are unavailable right now.' }, { status: 503 });
  }
}
