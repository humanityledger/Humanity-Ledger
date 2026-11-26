import { NextRequest, NextResponse } from 'next/server';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { getClientIP } from '@/lib/security/rateLimiter';

/**
 * POST /api/auth/kyc-qr-session
 *
 * Called by the mobile device after completing biometric verification.
 * Stores the encrypted liveness payload + score in Redis so the
 * PC can poll and decrypt it.
 *
 * Body:
 *   { uuid, encryptedPayload, livenessScore, spoofType? }
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req);

    // Rate limiting: max 3 attempts per IP per minute
    const rlKey = `kyc-rate-limit:${ip}`;
    const rlRaw = await safeRedisGet(rlKey);
    const rlCount = rlRaw ? parseInt(rlRaw, 10) : 0;

    if (rlCount >= 3) {
      return NextResponse.json(
        { error: 'Too Many Requests. System defense activated.' },
        { status: 429 }
      );
    }

    await safeRedisSet(rlKey, String(rlCount + 1), 'EX', 60);

    const body = await req.json();
    const { uuid, encryptedPayload, livenessScore, spoofType } = body;

    if (!uuid || typeof uuid !== 'string' || uuid.length < 8) {
      return NextResponse.json({ error: 'Invalid session identifier' }, { status: 400 });
    }

    if (!encryptedPayload) {
      return NextResponse.json({ error: 'Missing biometric payload' }, { status: 400 });
    }

    // Validate liveness score
    if (typeof livenessScore !== 'number' || livenessScore < 72) {
      console.warn(`[KYC:Session] Activeness score too low: ${livenessScore} for UUID: ${uuid.slice(0, 8)}`);
      return NextResponse.json(
        { error: 'Activeness verification did not meet threshold.' },
        { status: 422 }
      );
    }

    // Check the session exists and is PENDING (not already completed or burned)
    const existing = await safeRedisGet(`kyc-session:${uuid}`);
    if (!existing) {
      return NextResponse.json({ error: 'Session expired or not found.' }, { status: 404 });
    }

    let existingSession: Record<string, any>;
    try {
      existingSession = JSON.parse(existing);
    } catch {
      return NextResponse.json({ error: 'Corrupted session state.' }, { status: 409 });
    }

    if (existingSession.status !== 'PENDING') {
      return NextResponse.json({ error: 'Session already completed.' }, { status: 409 });
    }

    // Anti-spoofing gate: if server detects spoof  log and silently fail
    if (spoofType && spoofType !== null) {
      console.warn(`[KYC:Session] Spoof detected (${spoofType}) for UUID: ${uuid.slice(0, 8)}, IP: ${ip}`);
      // Return 200 but don't update the session (client sees no response)
      return NextResponse.json({ success: false, status: 'ANALYZING' });
    }

    // Write VERIFIED state
    const updatedSession = JSON.stringify({
      ...existingSession,
      status: 'VERIFIED',
      encryptedPayload,
      livenessScore,
      completedAt: Date.now(),
    });

    await safeRedisSet(`kyc-session:${uuid}`, updatedSession, 'EX', 120);

    console.log(`[KYC:Session] Verified  UUID: ${uuid.slice(0, 8)}, score: ${livenessScore}`);

    return NextResponse.json({ success: true, status: 'VERIFIED', timestamp: Date.now() });
  } catch (error: any) {
    console.error('[KYC:Session] Fault:', error);
    return NextResponse.json({ error: 'Internal cryptographic fault' }, { status: 500 });
  }
}
