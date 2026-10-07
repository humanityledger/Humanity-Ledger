import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { toAddress, title, body, icon } = await req.json();
    if (!toAddress) return NextResponse.json({ error: 'toAddress required' }, { status: 400 });
    
    const webpush = (await import('web-push')).default;
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:contact@humanidfi.com';
    
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 });
    }
    
    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
    
    const sub = await prisma.pushSubscription.findUnique({
      where: { walletAddress: toAddress.toLowerCase() }
    });
    
    if (!sub) return NextResponse.json({ skipped: true, reason: 'No subscription' });
    
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };
    
    await webpush.sendNotification(pushSub, JSON.stringify({
      title: title || 'Ledger Chat',
      body: body || 'You have a new message',
      icon: icon || '/icon.png',
      badge: '/icon.png'
    }));
    
    return NextResponse.json({ sent: true });
  } catch (e: any) {
    if (e.statusCode === 410) {
      // Subscription expired — clean up
      try {
        const { toAddress } = await req.json().catch(() => ({}));
        if (toAddress) await prisma.pushSubscription.delete({ where: { walletAddress: toAddress.toLowerCase() } }).catch(() => {});
      } catch {}
    }
    console.error('[push/send]', e);
    return NextResponse.json({ error: 'Push failed' }, { status: 500 });
  }
}
