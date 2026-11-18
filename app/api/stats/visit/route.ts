/**
 * POST /api/stats/visit { tz, vid } — counts this browser once per UTC day for the live map.
 *
 * `vid` is a random id the browser keeps for itself. The server keeps only a SHA-256 of it with
 * the day, in Redis, for 48 h, to count each browser once a day; it is never written to the
 * database. The database row holds the day, the time zone and a number. Public, 10 a minute per
 * address, and a time zone the tz database does not know is counted as "unknown".
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
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
  const body = await req.json().catch(() => ({}));
  const vid = typeof body?.vid === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(body.vid) ? body.vid : null;
  if (!vid) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const tz = coordsForTimeZone(body?.tz) ? (body.tz as string) : 'unknown';
  const day = utcDay();

  // Once per browser per day. If Redis is down the browser's own once-a-day check still holds.
  let first = true;
  try {
    const redis: any = await getRedisClient();
    const key = `visit:${day}:${createHash('sha256').update(vid).digest('hex').slice(0, 32)}`;
    first = (await redis.set(key, '1', 'EX', 172_800, 'NX')) === 'OK';
  } catch {
    first = true;
  }
  if (!first) return NextResponse.json({ counted: false });

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
