import { NextRequest, NextResponse } from 'next/server';
import { qrEphKey, setOnce, QR_UUID_RE } from '@/lib/security/qrLogin';
import { describeUserAgent } from '@/lib/auth/linkedDevices';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/qr-init — a computer opens a "link this device" QR code.
 *
 * Body: { uuid, pub, ecdh?, exp? }. Stores the computer's ephemeral public key and a plain
 * description of it ("Chrome on macOS", from its User-Agent) for 5 minutes, once per uuid.
 * The phone shows that description on its approval screen (GET /api/auth/link?uuid=…), so the
 * person can tell whether the code is really on their own computer.
 *
 * The reply sets qr_init_session: only this browser can poll the answer and finish signing in.
 * See lib/auth/linkedDevices.ts for the whole flow.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(getClientIP(req), { max: 30, windowSec: 600, prefix: 'rl:qr-init' });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many codes from this network. Wait a few minutes.' }, { status: 429 });

    const { uuid, pub, ecdh, exp } = await req.json().catch(() => ({}));
    if (typeof uuid !== 'string' || !QR_UUID_RE.test(uuid)) {
      return NextResponse.json({ error: 'Invalid uuid format' }, { status: 400 });
    }
    // The key is base64url: "x" (X25519) or "x,y" (P-256, what lib/web-crypto makes).
    if (typeof pub !== 'string' || pub.length > 400 || !/^[A-Za-z0-9+/=_,-]{20,}$/.test(pub)) {
      return NextResponse.json({ error: 'Invalid pub key format' }, { status: 400 });
    }

    const expMs = Number(exp);
    const ttl = Number.isFinite(expMs) && expMs > Date.now() ? Math.max(60, Math.ceil((expMs - Date.now()) / 1000)) : 300;
    const life = Math.min(ttl, 300);
    // Once per uuid: another browser cannot swap in its own key for a code someone else is showing.
    const created = await setOnce(
      qrEphKey(uuid),
      JSON.stringify({ pub, ecdh: ecdh === true || ecdh === '1' ? '1' : '0', exp: Date.now() + life * 1000, label: describeUserAgent(req.headers.get('user-agent')), createdAt: Date.now() }),
      life,
    );
    if (!created) {
      return NextResponse.json({ error: 'This code already exists. Refresh to get a new one.' }, { status: 409 });
    }

    const response = NextResponse.json({ ok: true, expiresAt: Date.now() + life * 1000 });
    response.cookies.set('qr_init_session', uuid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: life,
    });
    return response;
  } catch (e: any) {
    console.error('[qr-init]', e?.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
