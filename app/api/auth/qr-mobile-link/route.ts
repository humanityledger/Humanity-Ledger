import { NextRequest, NextResponse } from 'next/server';
import { mintJWT } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { QR_TTL_SEC, QR_UUID_RE, qrClaimKey, qrEphKey, qrSessionKey, readKey, setFor, setOnce } from '@/lib/security/qrLogin';
import { callerSession } from '@/lib/auth/linkedSession';
import { DEVICE_ID_RE } from '@/lib/auth/linkedDevices';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/qr-mobile-link — the phone approves linking a computer.
 *
 * Body: { uuid, desktopPub, encryptedPayload, iv, tag?, mobilePub, claimHash, deviceId }
 *
 * Only the phone that holds the account may do this: a session from a wallet sign-in, not a
 * linked computer (a computer cannot link further computers) and never the readable
 * `system_handshake` cookie. Until 2026-11-11 that cookie was accepted as the caller's
 * identity here; since /api/auth/* passes the middleware without a JWT, setting it to anyone's
 * address minted a session for that address. Fixed: only a verified, unrevoked JWT counts.
 *
 * The phone encrypted, to the computer's key (ECDH + HKDF), a random claim code and the
 * 256-bit channel key the two devices use from now on for signing requests
 * (lib/auth/linkedDevices.ts). The server stores only the ciphertext and the claim's SHA-256.
 * It mints the computer's session now (source 'linked-device', `did`) and hands it over in
 * /qr-hydrate to the browser that proves it decrypted the claim.
 */
const B64_RE = /^[A-Za-z0-9+/=_-]{8,20000}$/;
const PUB_RE = /^[A-Za-z0-9+/=_,-]{20,400}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

export async function POST(req: NextRequest) {
  try {
    const caller = await callerSession(req);
    if (!caller) {
      return NextResponse.json({ error: 'Sign in on this phone with your wallet first, then scan the code again.' }, { status: 401 });
    }
    if (caller.deviceId) {
      return NextResponse.json({ error: 'Link new devices from your phone, not from a linked computer.' }, { status: 403 });
    }
    const wallet = caller.wallet;

    const rl = await checkRateLimit(wallet, { max: 10, windowSec: 600, prefix: 'rl:qr-link' });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { uuid, desktopPub, encryptedPayload, iv, tag, mobilePub, claimHash, deviceId } = body ?? {};
    if (typeof uuid !== 'string' || !QR_UUID_RE.test(uuid)) {
      return NextResponse.json({ error: 'Missing or invalid uuid' }, { status: 400 });
    }
    if (typeof encryptedPayload !== 'string' || !B64_RE.test(encryptedPayload)
      || typeof iv !== 'string' || !B64_RE.test(iv)
      || (tag != null && (typeof tag !== 'string' || !B64_RE.test(tag)))
      || typeof mobilePub !== 'string' || !PUB_RE.test(mobilePub)
      || typeof desktopPub !== 'string' || !PUB_RE.test(desktopPub)
      || typeof claimHash !== 'string' || !HASH_RE.test(claimHash)
      || typeof deviceId !== 'string' || !DEVICE_ID_RE.test(deviceId)) {
      return NextResponse.json({ error: 'This version of Ledger Chat on your phone is out of date. Reload it and scan again.' }, { status: 400 });
    }

    // The computer must have opened this QR session, with this key.
    const eph = await readKey(qrEphKey(uuid));
    let rec: { pub?: string; label?: string } = {};
    try { rec = eph ? JSON.parse(eph) : {}; } catch { rec = {}; }
    if (!rec.pub || rec.pub !== desktopPub) {
      return NextResponse.json({ error: 'This QR code has expired. Refresh it on the computer.' }, { status: 410 });
    }

    // First answer wins: a second phone cannot replace the one that linked.
    const first = await setOnce(qrSessionKey(uuid), JSON.stringify({ encryptedPayload, iv, tag: tag ?? null, mobilePub }), QR_TTL_SEC);
    if (!first) return NextResponse.json({ error: 'This QR code was already used.' }, { status: 409 });

    const jwt = await mintJWT({ sub: wallet, address: wallet, iss: 'humanity-ledger', source: 'linked-device', did: deviceId });
    await setFor(qrClaimKey(uuid), JSON.stringify({ jwt, claimHash, wallet, deviceId, label: String(rec.label || 'Computer').slice(0, 60) }), QR_TTL_SEC);

    return NextResponse.json({ success: true, label: rec.label ?? null });
  } catch (e: any) {
    console.error('[QRMobileLink] Error:', e?.message);
    return NextResponse.json({ error: 'Server error during mobile QR link' }, { status: 500 });
  }
}
