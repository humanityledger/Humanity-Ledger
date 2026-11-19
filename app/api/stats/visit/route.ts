/**
 * POST /api/stats/visit { tz } — counts one visit for the live map.
 *
 * The browser sends only its time zone and keeps nothing (lib/stats/useVisitBeacon.ts). The
 * database row holds the day, the time zone and a number; no id and no IP address is stored. The
 * address is used only by the rate limit (10 a minute), which forgets it after a minute. A time
 * zone the tz database does not know is counted as "unknown". An id that an older client still
 * sends is ignored. Until 19 November 2026 each browser counted once a day; since then each
 * page load is a visit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { coordsForTimeZone, utcDay } from '@/lib/stats/live';

export const dynamic = 'force-dynamic';

const clientIp = (req: NextRequest) => {
  const xff = req.headers.get('x-forwarded-for') || '';
  const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || req.headers.get('x-real-ip') || 'unknown';
};

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(clientIp(req), { max: 10, windowSec: 60, prefix: 'rl:stats-visit' });
  if (!rl.allowed) return new NextResponse(null, { status: 204 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const tz = coordsForTimeZone((body as { tz?: unknown }).tz) ? ((body as { tz: string }).tz) : 'unknown';
  const day = utcDay();

  try {
    await prisma.visitorTally.upsert({
      where: { day_tz: { day, tz } },
      create: { day, tz, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch (e) {
    console.warn('[stats/visit] not counted:', (e as { code?: string })?.code ?? (e as Error)?.message);
    return NextResponse.json({ counted: false }, { status: 503 });
  }
  return NextResponse.json({ counted: true });
}
