import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/moonpay/sign — sign a MoonPay widget URL.
 *
 * It used to sign whatever URL it was given with the MoonPay secret: a
 * signing oracle any signed-in account could use, for any wallet address.
 * Now it signs only MoonPay buy/sell widget URLs, only for the caller's own
 * wallet, and only the parameters the widget uses.
 */
const HOSTS = new Set(['buy.moonpay.com', 'sell.moonpay.com', 'buy-sandbox.moonpay.com', 'sell-sandbox.moonpay.com']);
const PARAMS = new Set([
  'apiKey', 'currencyCode', 'walletAddress', 'baseCurrencyCode', 'baseCurrencyAmount', 'quoteCurrencyAmount',
  'colorCode', 'theme', 'showWalletAddressForm', 'language', 'redirectURL', 'lockAmount', 'email', 'externalTransactionId',
]);

export async function POST(req: Request) {
  const caller = await getVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = await checkRateLimit(caller, { max: 20, windowSec: 600, prefix: 'rl:moonpay-sign' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const { url } = await req.json();
    if (typeof url !== 'string' || url.length > 2_000) return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    const u = new URL(url);
    if (u.protocol !== 'https:' || !HOSTS.has(u.hostname) || u.username || u.password) {
      return NextResponse.json({ error: 'Only MoonPay widget URLs can be signed' }, { status: 400 });
    }
    for (const k of [...u.searchParams.keys()]) {
      if (!PARAMS.has(k)) return NextResponse.json({ error: `Unsupported parameter: ${k.slice(0, 40)}` }, { status: 400 });
    }
    const wallet = u.searchParams.get('walletAddress');
    if (wallet && wallet.toLowerCase() !== caller) {
      return NextResponse.json({ error: 'You can only buy to your own wallet' }, { status: 403 });
    }
    const redirect = u.searchParams.get('redirectURL');
    if (redirect) {
      const app = process.env.NEXT_PUBLIC_APP_URL;
      let ok = false;
      try { ok = !!app && new URL(redirect).origin === new URL(app).origin; } catch { ok = false; }
      if (!ok) return NextResponse.json({ error: 'Invalid redirect' }, { status: 400 });
    }

    const secretKey = process.env.MOONPAY_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ signedUrl: u.toString() });
    const signature = crypto.createHmac('sha256', secretKey).update(u.search).digest('base64');
    u.searchParams.set('signature', signature);
    return NextResponse.json({ signedUrl: u.toString() });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
