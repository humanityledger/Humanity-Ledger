/**
 * /api/notifications/inbox
 * 
 * GET  — returns unread notifications for the authenticated wallet
 * POST — marks notification(s) as read
 *        body: { ids: string[] }  or  { all: true }
 */
import { NextRequest, NextResponse } from 'next/server';
import * as prismaModule from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { safeRedisGet, safeRedisSet, safeRedisDel } from '@/lib/redis/client';

export const dynamic = 'force-dynamic';

const INBOX_CACHE_TTL_S = 15;
const resolveUserId = (req: NextRequest) => getVerifiedCaller(req);

function getInboxReadDb() {
  return Object.prototype.hasOwnProperty.call(prismaModule, 'prismaRead')
    ? (prismaModule as { prismaRead?: typeof prismaModule.prisma }).prismaRead ?? prismaModule.prisma
    : prismaModule.prisma;
}

export async function GET(req: NextRequest) {
  try {
    const address = await resolveUserId(req);
    if (!address) return NextResponse.json({ notifications: [], unreadCount: 0 });

    const cacheKey = `notif:inbox:v1:${address}`;
    const cached = await safeRedisGet(cacheKey);
    if (cached && cached !== 'TIMEOUT') {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.notifications)) {
          return NextResponse.json(parsed);
        }
      } catch {}
    }

    const dbRead = getInboxReadDb();
    // Find the User row to get its UUID (Notification table uses User.id not address)
    const user = await dbRead.user.findFirst({
      where: { walletAddress: address },
      select: { id: true },
    }).catch(() => null);

    if (!user) return NextResponse.json({ notifications: [], unreadCount: 0 });

    const notifications = await dbRead.notification.findMany({
      where: {
        OR: [
          { userId: user.id },
          { isGlobal: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const unreadCount = notifications.filter(n => !n.read).length;
    const payload = { notifications, unreadCount };
    await safeRedisSet(cacheKey, JSON.stringify(payload), 'EX', INBOX_CACHE_TTL_S);

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[Notifications] GET error:', err);
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const address = await resolveUserId(req);
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prismaModule.prisma.user.findFirst({
      where: { walletAddress: address },
      select: { id: true },
    }).catch(() => null);
    if (!user) return NextResponse.json({ ok: true });

    const { ids, all } = await req.json();

    if (all === true) {
      await prismaModule.prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
    } else if (Array.isArray(ids) && ids.length > 0) {
      const clean = ids.filter((x: unknown): x is string => typeof x === 'string' && x.length <= 64).slice(0, 200);
      if (!clean.length) return NextResponse.json({ ok: true });
      await prismaModule.prisma.notification.updateMany({
        where: { userId: user.id, id: { in: clean } },
        data: { read: true },
      });
    }

    await safeRedisDel(`notif:inbox:v1:${address}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Notifications] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
