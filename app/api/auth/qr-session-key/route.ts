import { NextRequest, NextResponse } from 'next/server';
import { safeRedisGet } from '@/lib/redis/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/qr-session-key?uuid=<uuid>
 *
 * Called by the MOBILE app after scanning the short QR code.
 * Returns the ephemeral public key that was stored by the desktop via qr-init.
 *
 * Security:
 *  - UUID validated against strict regex to prevent Redis key injection / enumeration
 *  - Expiry is enforced server-side (Redis TTL of 300s set at qr-init time)
 *  - This endpoint is intentionally unauthenticated: the mobile may be in incognito
 *    with no session yet when it scans. The returned key is a PUBLIC key — it is not
 *    a secret. The security guarantee is that only whoever holds the PRIVATE key
 *    (the desktop) can decrypt what the mobile encrypts.
 *
 * Response: { pub: string, ecdh: '0'|'1', exp: string }
 */

// UUID format guard — same as qr-poll and qr-sync-seed
const UUID_RE = /^[0-9a-z-]{6,64}$/i;

export async function GET(req: NextRequest) {
  const uuid = req.nextUrl.searchParams.get('uuid');

  // Strict format check prevents Redis key injection attacks
  if (!uuid || !UUID_RE.test(uuid)) {
    return NextResponse.json({ error: 'Missing or invalid uuid' }, { status: 400 });
  }

  const raw = await safeRedisGet(`qr-ephkey:${uuid}`);
  if (!raw) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  try {
    const data = JSON.parse(raw);

    // Validate expiry at the application layer as well (belt-and-suspenders)
    if (data.exp && Date.now() > parseInt(data.exp, 10)) {
      return NextResponse.json({ error: 'QR session expired. Please refresh the QR code.' }, { status: 410 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Malformed session data' }, { status: 500 });
  }
}
