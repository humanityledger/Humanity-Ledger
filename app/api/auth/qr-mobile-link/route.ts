import { NextRequest, NextResponse } from 'next/server';
import { mintJWT } from '@/lib/jwt';
import { getSession } from '@/lib/session';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { QR_TTL_SEC, QR_UUID_RE, qrClaimKey, qrEphKey, qrSessionKey, readKey, setFor, setOnce } from '@/lib/security/qrLogin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/qr-mobile-link — the phone approves a sign-in on a computer.
 *
 * Body: { uuid, desktopPub, encryptedPayload, iv, tag?, mobilePub, claimHash }
 *
 * The phone (signed in) has scanned the computer's QR code and typed the PIN
 * the computer shows. It encrypted a random claim code (plus its chat keys)
 * to the computer's key, mixed with that PIN, and sends here only the
 * ciphertext and the claim code's SHA-256.
 *
 * The server mints a session for the phone's wallet and keeps it next to the
 * claim hash. The computer gets the ciphertext from /qr-poll, decrypts the
 * claim code (only possible with its private key and the PIN) and trades it
 * at /qr-hydrate for HttpOnly cookies. The session token is never stored in
 * clear next to the ciphertext, returned to JavaScript, or handed to whoever
 * polls the QR session.
 *
 * Fix (2026-10-28): the previous version minted a token for ANY uuid and
 * stored it in clear for whoever polled that uuid. Together with the
 * automatic "link from URL" code in MobileEnforcer, opening one crafted link
 * on a signed-in phone gave an attacker's computer a session for that wallet.
 */
const B64_RE = /^[A-Za-z0-9+/=_-]{8,20000}$/;
const PUB_RE = /^[A-Za-z0-9+/=_,-]{20,400}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const wallet = session?.userId?.toLowerCase();
    if (!wallet || !/^0x[0-9a-f]{40}$/.test(wallet)) {
      return NextResponse.json(
        { error: 'Session unauthenticated. Sign the cryptographic message in your wallet first.' },
        { status: 401 },
      );
    }

    const rl = await checkRateLimit(wallet, { max: 10, windowSec: 600, prefix: 'rl:qr-link' });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { uuid, desktopPub, encryptedPayload, iv, tag, mobilePub, claimHash } = body ?? {};
    if (typeof uuid !== 'string' || !QR_UUID_RE.test(uuid)) {
      return NextResponse.json({ error: 'Missing or invalid uuid' }, { status: 400 });
    }
    if (typeof encryptedPayload !== 'string' || !B64_RE.test(encryptedPayload)
      || typeof iv !== 'string' || !B64_RE.test(iv)
      || (tag != null && (typeof tag !== 'string' || !B64_RE.test(tag)))
      || typeof mobilePub !== 'string' || !PUB_RE.test(mobilePub)
      || typeof desktopPub !== 'string' || !PUB_RE.test(desktopPub)
      || typeof claimHash !== 'string' || !HASH_RE.test(claimHash)) {
      return NextResponse.json({ error: 'Insecure or incomplete handshake. Please update the app and scan again.' }, { status: 400 });
    }

    // The computer must have opened this QR session, with this key.
    const eph = await readKey(qrEphKey(uuid));
    let ephPub: string | null = null;
    try { ephPub = eph ? JSON.parse(eph).pub : null; } catch { ephPub = null; }
    if (!ephPub || ephPub !== desktopPub) {
      return NextResponse.json({ error: 'This QR code has expired. Refresh it on the computer.' }, { status: 410 });
    }

    // First answer wins: a second phone cannot replace the one that linked.
    const first = await setOnce(qrSessionKey(uuid), JSON.stringify({ encryptedPayload, iv, tag: tag ?? null, mobilePub }), QR_TTL_SEC);
    if (!first) return NextResponse.json({ error: 'This QR code was already used.' }, { status: 409 });

    const jwt = await mintJWT({ sub: wallet, address: wallet, iss: 'humanity-ledger', source: 'qr-mobile-handshake' });
    await setFor(qrClaimKey(uuid), JSON.stringify({ jwt, claimHash, wallet }), QR_TTL_SEC);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[QRMobileLink] Error:', e?.message);
    return NextResponse.json({ error: 'Server error during mobile QR link' }, { status: 500 });
  }
}
