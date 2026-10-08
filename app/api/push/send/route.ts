import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { toAddress, title, body, icon, url } = await req.json();
    if (!toAddress) return NextResponse.json({ error: 'toAddress required' }, { status: 400 });

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:contact@humanidfi.com';

    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: 'VAPID keys not configured', hint: 'Add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to .env.local' }, { status: 503 });
    }

    let sub: any;
    try {
      const { prisma } = await import('@/lib/prisma');
      sub = await (prisma as any).pushSubscription.findUnique({
        where: { walletAddress: toAddress.toLowerCase() }
      });
    } catch {
      return NextResponse.json({ skipped: true, reason: 'DB not ready' });
    }

    if (!sub) return NextResponse.json({ skipped: true, reason: 'No subscription' });

    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };

    await webpush.sendNotification(pushSub, JSON.stringify({
      title: title || 'Ledger Chat',
      body: body || 'You have a new message',
      icon: icon || '/icon.png',
      badge: '/icon.png',
      url: url || '/chat'
    }));

    return NextResponse.json({ sent: true });
  } catch (e: any) {
    if (e.statusCode === 410) {
      // Subscription expired — clean up
      try {
        const { prisma } = await import('@/lib/prisma');
        const { toAddress } = await req.json().catch(() => ({}));
        if (toAddress) await (prisma as any).pushSubscription.delete({ where: { walletAddress: toAddress.toLowerCase() } }).catch(() => {});
      } catch {}
    }
    console.error('[push/send]', e);
    return NextResponse.json({ error: 'Push failed' }, { status: 500 });
  }
}
