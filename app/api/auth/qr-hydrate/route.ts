import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import { QR_UUID_RE, hashClaim, qrClaimKey, qrEphKey, qrSessionKey, sameHash, takeOnce } from '@/lib/security/qrLogin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/qr-hydrate — the computer finishes a sign-in by QR.
 *
 * Body: { uuid, claim }. Requires the qr_init_session cookie that
 * /api/auth/qr-init set on this browser for this uuid.
 *
 * `claim` is the random code the phone encrypted for this computer (see
 * qr-mobile-link). Only a browser holding the QR's private key and the PIN
 * it displayed can decrypt it. If its hash matches, the session minted for
 * the phone's wallet is set here as HttpOnly cookies and both QR records are
 * deleted, so the claim works once.
 *
 * Before 2026-10-28 this endpoint took a raw JWT from the page and set it as
 * the session; the token had reached the page in clear through qr-poll.
 */
export async function POST(req: NextRequest) {
  try {
    const { uuid, claim } = await req.json().catch(() => ({}));
    if (typeof uuid !== 'string' || !QR_UUID_RE.test(uuid) || typeof claim !== 'string' || claim.length < 32 || claim.length > 200) {
      return NextResponse.json({ error: 'Invalid sign-in request' }, { status: 400 });
    }
    if (req.cookies.get('qr_init_session')?.value !== uuid) {
      return NextResponse.json({ error: 'This sign-in was started in another browser.' }, { status: 401 });
    }

    const raw = await takeOnce(qrClaimKey(uuid));
    if (!raw) return NextResponse.json({ error: 'This QR sign-in has expired. Refresh the code.' }, { status: 410 });
    let rec: { jwt?: string; claimHash?: string; wallet?: string } = {};
    try { rec = JSON.parse(raw); } catch { rec = {}; }
    if (!rec.jwt || !rec.claimHash || !sameHash(hashClaim(claim), rec.claimHash)) {
      return NextResponse.json({ error: 'The code could not be verified. Scan the QR code again.' }, { status: 401 });
    }
    await Promise.all([takeOnce(qrSessionKey(uuid)), takeOnce(qrEphKey(uuid))]);

    const payload = await verifyJWT(rec.jwt);
    const address = String(payload.sub || payload.address || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const cookieDomain = (process.env.NODE_ENV === 'production' && appUrl)
      ? (() => { try { return new URL(appUrl).hostname; } catch { return undefined; } })()
      : undefined;
    const base = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 604800, // 7 days, the token's own lifetime
      path: '/',
      domain: cookieDomain,
    };

    const response = NextResponse.json({ success: true, address });
    // hl_session is the primary cookie (middleware, getSession); the legacy names keep older readers working.
    response.cookies.set('hl_session', rec.jwt, base);
    response.cookies.set('ledger_session', rec.jwt, base);
    response.cookies.set('human_session', rec.jwt, base);
    response.cookies.set('qr_init_session', '', { ...base, maxAge: 0 });
    return response;
  } catch (e: any) {
    console.error('[QR:Hydrate] Error:', e?.message);
    return NextResponse.json({ error: 'Sign-in failed' }, { status: 401 });
  }
}
