import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

/**
 * POST /api/auth/qr-hydrate
 *
 * Hydrates the desktop browser session from the JWT minted on mobile.
 * Sets secure httpOnly session cookies (ledger_session and human_session).
 */
export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    if (!jwt) return NextResponse.json({ error: 'Missing jwt' }, { status: 400 });

    const payload = await verifyJWT(jwt);
    const address = (payload.sub || payload.address) as string;

    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      return NextResponse.json({ error: 'JWT payload missing valid address' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const cookieDomain = (process.env.NODE_ENV === 'production' && appUrl)
        ? (() => { try { return new URL(appUrl).hostname; } catch { return undefined; } })()
        : undefined;

    const secureCookieBase = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 604800, // 7 days
      path: '/',
      domain: cookieDomain,
    };

    const response = NextResponse.json({
      success: true,
      address: address.toLowerCase(),
      jwt,
    });

    response.cookies.set('ledger_session', jwt, secureCookieBase);
    response.cookies.set('human_session', jwt, secureCookieBase);

    console.log(`[QR:Hydrate] Desktop session established for ${address}`);
    return response;
  } catch (e: any) {
    console.error('[QR:Hydrate] Error:', e?.message);
    return NextResponse.json({ error: 'Invalid JWT' }, { status: 401 });
  }
}
