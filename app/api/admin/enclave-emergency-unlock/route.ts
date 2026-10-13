import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-guard';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/enclave-emergency-unlock
 *
 * EMERGENCY ENDPOINT — deployed 2026-10-13 to fix mass lockout caused by
 * hashPin() using non-normalized (checksummed) userId as HMAC input.
 *
 * getSession() returns userId.toLowerCase() for SIWE sessions but legacy
 * email sessions can return a checksummed address. PINs hashed with
 * checksummed userId fail verification when session returns lowercase userId,
 * causing correct PINs to be rejected and users to hit MAX_ATTEMPTS lockout.
 *
 * Fix applied: hashPin() now always normalizes userId.toLowerCase() before HMAC.
 * Side effect: all existing PINs hashed with checksummed userId are now invalid.
 *
 * This endpoint:
 *  1. Clears enclaveOtpAttempts + enclaveOtpExpiresAt for ALL locked users
 *  2. Nulls out enclavePinHash for ALL users (forces them to re-set PIN)
 *     This is intentional — better UX than permanent lockout
 *
 * Requires: X-Admin-Secret header matching process.env.ADMIN_SECRET
 */
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const body = await req.json().catch(() => ({}));

    if (body?.confirm !== 'EMERGENCY_UNLOCK') {
      return NextResponse.json({
        error: 'Pass { "confirm": "EMERGENCY_UNLOCK" } to execute.',
        hint: 'This will clear all PIN lockouts and reset all PIN hashes so users can re-enroll.'
      }, { status: 400 });
    }

    // Step 1: Unlock all locked users (clear attempt counters)
    const [unlockedUsers, unlockedAuthUsers] = await Promise.all([
      prisma.user.updateMany({
        where: { enclaveOtpAttempts: { gt: 0 } },
        data: { enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null },
      }).catch(() => ({ count: 0 })),
      prisma.authUser.updateMany({
        where: {},
        data: { enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any,
      }).catch(() => ({ count: 0 })),
    ]);

    // Step 2: Clear all PIN hashes so users re-enroll with correct normalized hash
    // They will be treated as first-time users and guided through setup
    const [clearedUsers, clearedAuthUsers] = await Promise.all([
      prisma.user.updateMany({
        where: { enclavePinHash: { not: null } },
        data: { enclavePinHash: null } as any,
      }).catch(() => ({ count: 0 })),
      prisma.authUser.updateMany({
        where: {},
        data: { enclavePinHash: null } as any,
      }).catch(() => ({ count: 0 })),
    ]);

    // Step 3: Clear the OTP clearance tokens from DB (now stale)
    await Promise.all([
      prisma.user.updateMany({
        where: {},
        data: { enclaveClearanceToken: null, enclaveClearanceTs: null } as any,
      }).catch(() => {}),
      prisma.authUser.updateMany({
        where: {},
        data: { enclaveClearanceToken: null, enclaveClearanceTs: null } as any,
      }).catch(() => {}),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Emergency unlock complete. All users must re-enroll their PIN on next Ledger Chat visit.',
      stats: {
        unlockedUsers: (unlockedUsers as any).count,
        unlockedAuthUsers: (unlockedAuthUsers as any).count,
        clearedPinHashes_users: (clearedUsers as any).count,
        clearedPinHashes_authUsers: (clearedAuthUsers as any).count,
      },
    });

  } catch (err: any) {
    console.error('[Emergency Unlock] Error:', err);
    return NextResponse.json({ error: 'Internal server error', detail: err.message }, { status: 500 });
  }
}

/**
 * GET — Status check: how many users are currently locked?
 */
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const now = new Date();
    const [lockedUsers, lockedAuthUsers, totalWithPin] = await Promise.all([
      prisma.user.count({
        where: {
          enclaveOtpAttempts: { gte: 8 },
          enclaveOtpExpiresAt: { gt: now },
        },
      }).catch(() => 0),
      prisma.authUser.count({
        where: {
          enclaveOtpAttempts: { gte: 8 },
          enclaveOtpExpiresAt: { gt: now },
        } as any,
      }).catch(() => 0),
      prisma.user.count({
        where: { enclavePinHash: { not: null } } as any,
      }).catch(() => 0),
    ]);

    return NextResponse.json({
      currentlyLocked: lockedUsers + lockedAuthUsers,
      usersWithPinSet: totalWithPin,
      message: lockedUsers + lockedAuthUsers > 0
        ? `⚠️ ${lockedUsers + lockedAuthUsers} users currently locked out. POST with { "confirm": "EMERGENCY_UNLOCK" } to fix.`
        : '✅ No users currently locked.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
