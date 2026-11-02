import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/send — show a notification on the caller's own devices.
 *
 * The chat calls this when a message arrives in a hidden tab, so the phone
 * or computer the person subscribed with shows it.
 *
 * [SECURITY 2026-10-28] It used to send to any `toAddress`, with any title,
 * text and link: any signed-in account could push a notification that looked
 * like it came from Ledger Chat to anyone, linking to any site (phishing).
 * Notifications now go only to the caller's own subscription, the link must
 * be a path on this site, and the text is limited.
 */
export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const caller = auth.walletAddress.toLowerCase();

  const rl = await checkRateLimit(caller, { max: 60, windowSec: 600, prefix: 'rl:push-self' });
  if (!rl.allowed) return NextResponse.json({ skipped: true, reason: 'rate_limited' }, { status: 429 });

  const payload = await req.json().catch(() => ({}));
  const { toAddress, title, body, url } = payload ?? {};
  if (typeof toAddress === 'string' && toAddress && toAddress.toLowerCase() !== caller) {
    return NextResponse.json({ error: 'Notifications can only be sent to your own devices.' }, { status: 403 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:contact@humanidfi.com';
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ skipped: true, reason: 'Push is not configured' }, { status: 503 });
  }

  const { prisma } = await import('@/lib/prisma');
  let sub: any;
  try {
    sub = await (prisma as any).pushSubscription.findUnique({ where: { walletAddress: caller } });
  } catch {
    return NextResponse.json({ skipped: true, reason: 'DB not ready' });
  }
  if (!sub) return NextResponse.json({ skipped: true, reason: 'No subscription' });

  let webpush: any;
  try {
    webpush = createRequire(import.meta.url)('web-push');
  } catch {
    return NextResponse.json({ skipped: true, reason: 'web-push module not available' });
  }
  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

  // A path on this site only ("/chat"), never another origin or "//host".
  const safeUrl = typeof url === 'string' && /^\/(?![/\\])[\w\-./?=&%#]{0,200}$/.test(url) ? url : '/chat';
  const text = (v: unknown, fallback: string, max: number) =>
    typeof v === 'string' && v.trim() ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : fallback;

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({
        title: text(title, 'Ledger Chat', 60),
        body: text(body, 'You have a new message', 140),
        icon: '/icon.png',
        badge: '/icon.png',
        url: safeUrl,
      }),
    );
    return NextResponse.json({ sent: true });
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      // The browser dropped the subscription: forget it.
      await (prisma as any).pushSubscription.delete({ where: { walletAddress: caller } }).catch(() => {});
      return NextResponse.json({ skipped: true, reason: 'Subscription expired' });
    }
    console.error('[push/send]', e?.statusCode ?? e?.message);
    return NextResponse.json({ error: 'Push failed' }, { status: 500 });
  }
}
