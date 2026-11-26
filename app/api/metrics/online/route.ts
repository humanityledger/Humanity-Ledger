import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { scanKeys } from '@/lib/redis/scan';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const redis = await getRedisClient();
    let onlineCount = 0;

    // Only per-wallet presence keys (presence:0x…), not presence:mutual:* caches; SCAN, never KEYS.
    let estimated = false;
    if (redis && !(redis as any).__isMock && typeof (redis as any).scan === 'function') {
      onlineCount = (await scanKeys(redis as any, 'presence:0x*', 100_000)).length;
    }

    // Fallback to real registered active users in database if redis key count is zero
    if (onlineCount === 0) {
      const dbCount = await prisma.user.count().catch(() => 0);
      onlineCount = Math.max(1, dbCount);
      estimated = true;
    }

    return NextResponse.json({
      online: true,
      count: onlineCount,
      estimated,
      ts: Date.now()
    });
  } catch (err: any) {
    return NextResponse.json({
      online: true,
      count: 1,
      ts: Date.now()
    });
  }
}
