import { NextRequest, NextResponse } from 'next/server';
import { qrEphKey, setOnce } from '@/lib/security/qrLogin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/qr-init
 * 
 * The desktop generates an ephemeral key pair and calls this endpoint
 * to store the PUBLIC key in Redis, keyed by a short UUID.
 * 
 * The QR code then only encodes a short URL:
 *   https://humanidfi.com/connect?s=<uuid>
 * 
 * This reduces QR data from ~600 chars → ~50 chars, making it scannable
 * at 100% zoom on any phone without requiring the user to zoom in.
 * 
 * The mobile app reads the public key via GET /api/auth/qr-session-key?uuid=<uuid>
 * before encrypting the session payload with ECDH/X25519.
 */
export async function POST(req: NextRequest) {
  try {
    const { uuid, pub, ecdh, exp } = await req.json();
    if (!uuid || !pub) {
      return NextResponse.json({ error: 'Missing uuid or pub' }, { status: 400 });
    }

    // [SECURITY] Validate UUID format to prevent Redis key injection
    const UUID_RE = /^[0-9a-z-]{6,64}$/i;
    if (!UUID_RE.test(uuid)) {
      return NextResponse.json({ error: 'Invalid uuid format' }, { status: 400 });
    }
    // [SECURITY] The key is base64url: "x" (X25519) or "x,y" (P-256, what lib/web-crypto makes).
    if (typeof pub !== 'string' || pub.length > 400 || !/^[A-Za-z0-9+/=_,-]{20,}$/.test(pub)) {
      return NextResponse.json({ error: 'Invalid pub key format' }, { status: 400 });
    }

    const expMs = Number(exp);
    const ttl = Number.isFinite(expMs) && expMs > 0 ? Math.max(60, Math.ceil((expMs - Date.now()) / 1000)) : 300;
    // Once per uuid: another browser cannot swap in its own key for a code
    // someone else is showing (the uuid is printed in the QR code).
    const created = await setOnce(
      qrEphKey(uuid),
      JSON.stringify({ pub, ecdh: ecdh === true || ecdh === '1' ? '1' : '0', exp }),
      Math.min(ttl, 300),
    );
    if (!created) {
      return NextResponse.json({ error: 'This code already exists. Refresh to get a new one.' }, { status: 409 });
    }

    const response = NextResponse.json({ ok: true });
    
    // [AUDIT FIX A4] Bind the ephemeral QR session to the creator's browser via cookie
    // This prevents attackers from remotely polling or hijacking the QR session
    response.cookies.set('qr_init_session', uuid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: Math.min(ttl, 300)
    });
    
    return response;
  } catch (e: any) {
    console.error('[qr-init]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
