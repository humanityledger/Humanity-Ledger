import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/subscribe — store this browser's push subscription for the
 * signed-in wallet.
 *
 * The wallet used to come from the request body, so anyone signed in could
 * register their own browser under someone else's address and receive that
 * person's notifications. It now comes from the session; a body address that
 * differs is refused. The endpoint must be an https push service URL.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const caller = auth.walletAddress;

    const { subscription, walletAddress } = await req.json().catch(() => ({}));
    if (typeof walletAddress === 'string' && walletAddress.toLowerCase() !== caller) {
      return NextResponse.json({ error: 'You can only register notifications for your own account.' }, { status: 403 });
    }
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const authKey = subscription?.keys?.auth;
    if (typeof endpoint !== 'string' || !/^https:\/\/[^\s]{8,1000}$/.test(endpoint)) {
      return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 });
    }
    if (typeof p256dh !== 'string' || typeof authKey !== 'string' || p256dh.length > 200 || authKey.length > 100) {
      return NextResponse.json({ error: 'Invalid push subscription keys.' }, { status: 400 });
    }

    await (prisma as any).pushSubscription.upsert({
      where: { walletAddress: caller },
      update: { endpoint, p256dh, auth: authKey, updatedAt: new Date() },
      create: { walletAddress: caller, endpoint, p256dh, auth: authKey },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[push/subscribe]', e?.message);
    return NextResponse.json({ error: 'The subscription could not be saved.' }, { status: 500 });
  }
}
