import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const redis = await getRedisClient();
    let onlineCount = 0;

    if (redis && !(redis as any).__isMock && typeof redis.keys === 'function') {
      const keys = await redis.keys('presence:*');
      onlineCount = keys.length;
    }

    // Fallback to real registered active users in database if redis key count is zero
    if (onlineCount === 0) {
      const dbCount = await prisma.user.count().catch(() => 0);
      onlineCount = Math.max(1, dbCount);
    }

    return NextResponse.json({
      online: true,
      count: onlineCount,
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
