import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { subscription, walletAddress } = await req.json();
    if (!subscription || !walletAddress) {
      return NextResponse.json({ error: 'Missing subscription or address' }, { status: 400 });
    }
    // Store subscription in DB or localStorage-based fallback
    // Upsert the push subscription
    const existing = await prisma.pushSubscription.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, updatedAt: new Date() },
      create: { walletAddress: walletAddress.toLowerCase(), endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[push/subscribe]', e);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}
