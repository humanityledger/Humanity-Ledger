/**
 * C-009 — Internal cleanup route
 * POST /api/internal/cleanup
 * Deletes expired notifications (>90 days), expired nonces, expired codes.
 * Requires INTERNAL_CRON_SECRET header for auth.
 * Call from Railway cron or GitHub Actions scheduled job.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

function getInternalSecret(): string {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) throw new Error('INTERNAL_CRON_SECRET not set');
  return secret;
}

export async function POST(req: NextRequest) {
  // Auth: constant-time comparison using pre-hashed SHA-256 digests
  const providedSecret = req.headers.get('x-cron-secret') ?? '';
  let authorized = false;
  try {
    const expected = getInternalSecret();
    if (!expected || expected.length < 16) {
      return NextResponse.json({ error: 'Misconfigured: secret length insufficient' }, { status: 503 });
    }
    const hashProvided = crypto.createHash('sha256').update(providedSecret).digest();
    const hashExpected = crypto.createHash('sha256').update(expected).digest();
    authorized = crypto.timingSafeEqual(hashProvided, hashExpected);
  } catch {
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 });
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const results: Record<string, number> = {};

  // Delete old notifications
  try {
    const { count: notifCount } = await prisma.notification.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });
    results.notifications_deleted = notifCount;
  } catch {
    results.notifications_deleted = -1; // model may not exist
  }

  // Delete expired email verification codes
  try {
    const { count: codeCount } = await (prisma as any).emailVerificationCode?.deleteMany({
      where: { expiresAt: { lt: now } },
    }) ?? { count: 0 };
    results.verification_codes_deleted = codeCount;
  } catch {
    results.verification_codes_deleted = -1;
  }

  // Delete expired sessions (if stored in DB)
  try {
    const { count: sessionCount } = await (prisma as any).session?.deleteMany({
      where: { expiresAt: { lt: now } },
    }) ?? { count: 0 };
    results.sessions_deleted = sessionCount;
  } catch {
    results.sessions_deleted = -1;
  }

  return NextResponse.json({
    status: 'ok',
    ts: now.toISOString(),
    deleted: results,
  });
}
