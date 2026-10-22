// app/api/auth/enclave-pin/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Enclave PIN — Server-Side Verification & Provisioning
//
// SECURITY MODEL:
//   - PIN is stored as Argon2id(pin, salt) with fallback to HMAC-SHA256 — never plaintext
//   - Brute-force protection: max 8 attempts per 5 minutes per session/IP
//   - A-009: resolveUserId ONLY uses getSession() — no JWT fallbacks, no headers
//   - A-010: getEnclavePinPepper / getEnclavePinSecret FAIL HARD if env var absent
//   - A-011: DELETE requires current PIN or OTP code — no unauthenticated reset
//   - A-012: POST returns 404 if no PIN is set (no auto-provisioning in POST)
//   - A-013: GET never emits clearanceToken
//   - A-014: clearanceToken compared with timingSafeEqual
//   - B-020: Semaphore limits concurrent Argon2id ops to 4
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import crypto from 'crypto';
import { argon2id } from '@noble/hashes/argon2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_ATTEMPTS = 8;                     // 8 attempts

// A-010: FAIL HARD if env vars are absent — no fallbacks
function getEnclavePinPepper(): string {
  const pepper = process.env.ENCLAVE_PIN_PEPPER;
  if (!pepper) {
    throw new Error(
      '[SECURITY CRITICAL] ENCLAVE_PIN_PEPPER is not set. ' +
      'The server cannot process PIN operations without this secret. ' +
      'Set ENCLAVE_PIN_PEPPER in your environment immediately.'
    );
  }
  return pepper;
}

function getEnclavePinSecret(): string {
  const secret = process.env.ENCLAVE_PIN_SECRET;
  if (!secret) {
    throw new Error(
      '[SECURITY CRITICAL] ENCLAVE_PIN_SECRET is not set. ' +
      'The server cannot process PIN operations without this secret. ' +
      'Set ENCLAVE_PIN_SECRET in your environment immediately.'
    );
  }
  return secret;
}

// B-020: Concurrency semaphore — max 4 simultaneous Argon2id operations
let _argonConcurrent = 0;
const _argonQueue: Array<() => void> = [];
const ARGON_MAX_CONCURRENT = 4;

async function withArgonSemaphore<T>(fn: () => T): Promise<T> {
  if (_argonConcurrent >= ARGON_MAX_CONCURRENT) {
    await new Promise<void>((resolve) => _argonQueue.push(resolve));
  }
  _argonConcurrent++;
  try {
    return fn();
  } finally {
    _argonConcurrent--;
    const next = _argonQueue.shift();
    if (next) next();
  }
}

function hashPinArgon2id(userId: string, pin: string): string {
  const pepper = getEnclavePinPepper();
  const normalizedId = userId.toLowerCase();
  const salt = utf8ToBytes(`${normalizedId}:${pepper}`.slice(0, 32).padEnd(16, '0'));
  const pinBytes = utf8ToBytes(pin);
  const hash = argon2id(pinBytes, salt, {
    m: 65536,
    t: 3,
    p: 1,
    dkLen: 32,
  });
  return bytesToHex(hash);
}

function hashPinLegacy(userId: string, pin: string): string {
  const secret = getEnclavePinSecret();
  const normalizedId = userId.toLowerCase();
  return crypto
    .createHmac('sha256', secret)
    .update(`${normalizedId}:${pin}`)
    .digest('hex');
}

/**
 * Verify a submitted PIN against the stored hash.
 *
 * This function used to be synchronous while calling `withArgonSemaphore`,
 * which is declared `async` and therefore ALWAYS returns a Promise regardless
 * of whether the work inside it is synchronous. `Buffer.from(promise, 'hex')`
 * throws a TypeError, the catch below swallowed it, and the function returned
 * false.
 *
 * The effect was total: a PIN could be configured (PUT awaits correctly and
 * stores a valid Argon2id hash) and then never verified, because every check
 * threw before reaching the comparison. The legacy HMAC branch below was
 * unreachable for the same reason. The failure was silent — a wrong-PIN
 * response, not an error — which is why it survived.
 *
 * The comment that used to sit here said "argonHash is synchronous inside
 * withArgonSemaphore". The hash is; the wrapper is not.
 */
async function verifyPin(userId: string, pin: string, storedHash: string): Promise<boolean> {
  try {
    const argonHash = await withArgonSemaphore(() => hashPinArgon2id(userId, pin));
    const argonBuf = Buffer.from(argonHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (argonBuf.length === storedBuf.length && crypto.timingSafeEqual(argonBuf, storedBuf)) {
      return true;
    }
    // Backward compatibility with legacy HMAC-SHA256
    const legacyHash = hashPinLegacy(userId, pin);
    const legacyBuf = Buffer.from(legacyHash, 'hex');
    if (legacyBuf.length === storedBuf.length && crypto.timingSafeEqual(legacyBuf, storedBuf)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function issueClearanceToken(userId: string, ts: number): string {
  const clearanceSecret = getEnclavePinSecret();
  return crypto
    .createHmac('sha256', clearanceSecret)
    .update(`${userId}:cleared:${ts}`)
    .digest('hex');
}

// A-009: resolveUserId ONLY uses getSession() — no JWT fallbacks, no header fallbacks
async function resolveUserId(): Promise<string | null> {
  try {
    const session = await getSession();
    if (session?.userId) return session.userId.toLowerCase();
  } catch {}
  return null;
}

// ── POST — Verify PIN ─────────────────────────────────────────────────────────
// A-012: POST returns 404 with { needsPinSetup: true } if no PIN is set
export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Session expired. Please reconnect.', noSession: true }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { pin } = body;

    if (!pin || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 6 digits.' }, { status: 400 });
    }

    // Check DB Rate Limit
    let userRow = await prisma.user.findUnique({
      where: { walletAddress: userId.toLowerCase() },
      select: { id: true, enclavePinHash: true, enclaveOtpAttempts: true, enclaveOtpExpiresAt: true } as any,
    }).catch(() => null);

    let authUserRow: any = null;
    if (!userRow) {
      authUserRow = await prisma.authUser.findFirst({
        where: { OR: [{ id: userId }, { walletAddress: userId.toLowerCase() }] },
        select: { id: true, enclavePinHash: true, enclaveOtpAttempts: true, enclaveOtpExpiresAt: true } as any,
      }).catch(() => null);
    }

    const dbRow: any = userRow || authUserRow;
    const isUserTable = !!userRow;

    // Determine lockout state
    if (dbRow?.enclaveOtpExpiresAt && new Date() < new Date(dbRow.enclaveOtpExpiresAt)) {
      if ((dbRow.enclaveOtpAttempts || 0) >= MAX_ATTEMPTS) {
        const retryAfterMin = Math.ceil((new Date(dbRow.enclaveOtpExpiresAt).getTime() - Date.now()) / 60000);
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${retryAfterMin} minutes.`, blocked: true },
          { status: 429 }
        );
      }
    }

    const storedPinHash = dbRow?.enclavePinHash || null;

    // A-012: If no PIN is set, return 404 with needsPinSetup flag — do NOT auto-provision
    if (!storedPinHash) {
      return NextResponse.json({ error: 'No PIN configured for this account.', needsPinSetup: true }, { status: 404 });
    }

    // Existing PIN verification
    const isValid = await verifyPin(userId, pin, storedPinHash);

    if (!isValid) {
      const now = new Date();
      const isWindowExpired = !dbRow?.enclaveOtpExpiresAt || now > new Date(dbRow.enclaveOtpExpiresAt);
      const newAttempts = isWindowExpired ? 1 : (dbRow?.enclaveOtpAttempts || 0) + 1;
      const newExpiresAt = isWindowExpired ? new Date(now.getTime() + ATTEMPT_WINDOW_MS) : dbRow?.enclaveOtpExpiresAt;

      if (isUserTable) {
        await prisma.user.update({
          where: { walletAddress: userId.toLowerCase() },
          data: { enclaveOtpAttempts: newAttempts, enclaveOtpExpiresAt: newExpiresAt }
        }).catch(() => {});
      } else if (authUserRow) {
        await prisma.authUser.update({
          where: { id: authUserRow.id },
          data: { enclaveOtpAttempts: newAttempts, enclaveOtpExpiresAt: newExpiresAt } as any
        }).catch(() => {});
      }

      const remaining = Math.max(0, MAX_ATTEMPTS - newAttempts);
      return NextResponse.json(
        {
          error: `Incorrect PIN. ${remaining} attempts remaining before lockout.`,
          attemptsRemaining: remaining,
        },
        { status: 401 }
      );
    }

    // Success — clear lockout
    if ((dbRow?.enclaveOtpAttempts || 0) > 0) {
      if (isUserTable) {
        await prisma.user.update({
          where: { walletAddress: userId.toLowerCase() },
          data: { enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null }
        }).catch(() => {});
      } else if (authUserRow) {
        await prisma.authUser.update({
          where: { id: authUserRow.id },
          data: { enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any
        }).catch(() => {});
      }
    }

    const clearanceTs = Date.now();
    const clearanceToken = issueClearanceToken(userId, clearanceTs);

    return NextResponse.json({
      success: true,
      clearanceToken,
      clearanceTs,
      isFirstTimeUser: false,
    });

  } catch (err: any) {
    console.error('[Enclave PIN] Verify error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// ── GET — Check if PIN is set ─────────────────────────────────────────────
// A-013: GET never emits clearanceToken
export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ hasPin: false, noSession: true }, { status: 401 });
    }

    let storedPinHash: string | null = null;

    const user = await prisma.user.findUnique({
      where: { walletAddress: userId.toLowerCase() },
      select: { enclavePinHash: true } as any,
    }).catch(() => null);

    if (user && (user as any).enclavePinHash) {
      storedPinHash = (user as any).enclavePinHash;
    } else {
      const authUser = await prisma.authUser.findFirst({
        where: { OR: [{ id: userId }, { walletAddress: userId.toLowerCase() }] },
        select: { enclavePinHash: true } as any,
      }).catch(() => null);
      if (authUser && (authUser as any).enclavePinHash) {
        storedPinHash = (authUser as any).enclavePinHash;
      }
    }

    // A-013: hasPin=false → no clearanceToken in response
    if (!storedPinHash) {
      return NextResponse.json({ hasPin: false });
    }

    return NextResponse.json({ hasPin: true });
  } catch (err) {
    return NextResponse.json({ hasPin: false });
  }
}

// ── PUT — Set/Update PIN ──────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Session expired. Please reconnect.', noSession: true }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { currentPin, newPin, clearanceToken: clientClearanceToken, clearanceTs: clientClearanceTs } = body;

    if (!newPin || !/^\d{6}$/.test(newPin)) {
      return NextResponse.json({ error: 'New PIN must be exactly 6 digits.' }, { status: 400 });
    }

    let storedPinHash: string | null = null;
    let dbId: string | null = null;
    let dbTable: 'user' | 'authUser' = 'user';
    let dbOtpAttempts = 0;
    let dbOtpExpiresAt: Date | null = null;

    const userRow = await prisma.user.findUnique({
      where: { walletAddress: userId.toLowerCase() },
      select: { id: true, enclavePinHash: true, enclaveOtpAttempts: true, enclaveOtpExpiresAt: true } as any,
    }).catch(() => null);

    if (userRow) {
      dbId = (userRow as any).id;
      storedPinHash = (userRow as any).enclavePinHash ?? null;
      dbOtpAttempts = (userRow as any).enclaveOtpAttempts || 0;
      dbOtpExpiresAt = (userRow as any).enclaveOtpExpiresAt || null;
    } else {
      const authRow = await prisma.authUser.findFirst({
        where: { OR: [{ id: userId }, { walletAddress: userId.toLowerCase() }] },
        select: { id: true, enclavePinHash: true, enclaveOtpAttempts: true, enclaveOtpExpiresAt: true } as any,
      }).catch(() => null);
      if (authRow) {
        dbId = (authRow as any).id;
        dbTable = 'authUser';
        storedPinHash = (authRow as any).enclavePinHash ?? null;
        dbOtpAttempts = (authRow as any).enclaveOtpAttempts || 0;
        dbOtpExpiresAt = (authRow as any).enclaveOtpExpiresAt || null;
      }
    }

    const newPinHash = await withArgonSemaphore(() => hashPinArgon2id(userId, newPin));

    // Initial PIN configuration (no previous PIN stored) — PUT is the setup path
    if (!storedPinHash) {
      try {
        await prisma.user.upsert({
          where: { walletAddress: userId.toLowerCase() },
          create: {
            walletAddress: userId.toLowerCase(),
            enclavePinHash: newPinHash,
          },
          update: {
            enclavePinHash: newPinHash,
            enclaveOtpAttempts: 0,
            enclaveOtpExpiresAt: null,
          },
        });
      } catch {
        if (dbTable === 'authUser' && dbId) {
          await prisma.authUser.update({
            where: { id: dbId },
            data: { enclavePinHash: newPinHash, enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any,
          }).catch(() => {});
        }
      }

      const clearanceTs = Date.now();
      const clearanceToken = issueClearanceToken(userId, clearanceTs);

      return NextResponse.json({
        success: true,
        message: 'Enclave PIN configured successfully.',
        clearanceToken,
        clearanceTs,
      });
    }

    // Changing existing PIN: Check clearance token from OTP reset or verify currentPin
    // A-014: Use timingSafeEqual for clearanceToken comparison
    let isAuthorized = false;

    if (clientClearanceToken && clientClearanceTs) {
      const expectedToken = issueClearanceToken(userId, Number(clientClearanceTs));
      const isRecent = Date.now() - Number(clientClearanceTs) < 15 * 60 * 1000;
      try {
        const expectedBuf = Buffer.from(expectedToken, 'hex');
        const clientBuf = Buffer.from(clientClearanceToken, 'hex');
        if (
          isRecent &&
          expectedBuf.length === clientBuf.length &&
          crypto.timingSafeEqual(expectedBuf, clientBuf)
        ) {
          isAuthorized = true;
        }
      } catch {
        // Buffer length mismatch or invalid hex — treat as unauthorized
      }
    }

    if (!isAuthorized) {
      if (!currentPin) {
        return NextResponse.json({ error: 'Current PIN is required to change PIN.' }, { status: 400 });
      }

      if (dbOtpExpiresAt && new Date() < new Date(dbOtpExpiresAt)) {
        if (dbOtpAttempts >= MAX_ATTEMPTS) {
          const retryAfterMin = Math.ceil((new Date(dbOtpExpiresAt).getTime() - Date.now()) / 60000);
          return NextResponse.json({ error: `Too many attempts. Try again in ${retryAfterMin} minutes.` }, { status: 429 });
        }
      }

      const isCurrentValid = await verifyPin(userId, currentPin, storedPinHash);
      if (!isCurrentValid) {
        const now = new Date();
        const isWindowExpired = !dbOtpExpiresAt || now > new Date(dbOtpExpiresAt);
        const newAttempts = isWindowExpired ? 1 : dbOtpAttempts + 1;
        const newExpiresAt = isWindowExpired ? new Date(now.getTime() + ATTEMPT_WINDOW_MS) : dbOtpExpiresAt;

        if (dbTable === 'user') {
          await prisma.user.update({
            where: { walletAddress: userId.toLowerCase() },
            data: { enclaveOtpAttempts: newAttempts, enclaveOtpExpiresAt: newExpiresAt }
          }).catch(() => {});
        } else if (dbId) {
          await prisma.authUser.update({
            where: { id: dbId },
            data: { enclaveOtpAttempts: newAttempts, enclaveOtpExpiresAt: newExpiresAt } as any
          }).catch(() => {});
        }

        return NextResponse.json({ error: 'Current PIN incorrect.' }, { status: 401 });
      }
    }

    // Save updated PIN
    if (dbTable === 'user') {
      await prisma.user.update({
        where: { walletAddress: userId.toLowerCase() },
        data: { enclavePinHash: newPinHash, enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any,
      }).catch(() => {});
    } else if (dbId) {
      await prisma.authUser.update({
        where: { id: dbId },
        data: { enclavePinHash: newPinHash, enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any,
      }).catch(() => {});
    }

    const clearanceTs = Date.now();
    const clearanceToken = issueClearanceToken(userId, clearanceTs);

    return NextResponse.json({
      success: true,
      message: 'Enclave PIN updated successfully.',
      clearanceToken,
      clearanceTs,
    });

  } catch (err: any) {
    console.error('[Enclave PIN] Update error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// ── DELETE — Reset PIN ────────────────────────────────────────────────────────
// A-011: DELETE requires current PIN or OTP code — no unauthenticated reset
export async function DELETE(req: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Session expired. Please reconnect.', noSession: true }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { currentPin, otpCode, clearanceToken: clientClearanceToken, clearanceTs: clientClearanceTs } = body;

    // A-011: Must provide currentPin or clearanceToken (from OTP flow) — else 403
    if (!currentPin && !otpCode && !(clientClearanceToken && clientClearanceTs)) {
      return NextResponse.json(
        { error: 'Forbidden: Current PIN or OTP verification required to reset PIN.' },
        { status: 403 }
      );
    }

    // Resolve stored PIN for verification
    let storedPinHash: string | null = null;
    let dbTable: 'user' | 'authUser' = 'user';
    let dbId: string | null = null;

    const userRow = await prisma.user.findUnique({
      where: { walletAddress: userId.toLowerCase() },
      select: { id: true, enclavePinHash: true } as any,
    }).catch(() => null);

    if (userRow) {
      dbId = (userRow as any).id;
      storedPinHash = (userRow as any).enclavePinHash ?? null;
    } else {
      const authRow = await prisma.authUser.findFirst({
        where: { OR: [{ id: userId }, { walletAddress: userId.toLowerCase() }] },
        select: { id: true, enclavePinHash: true } as any,
      }).catch(() => null);
      if (authRow) {
        dbTable = 'authUser';
        dbId = (authRow as any).id;
        storedPinHash = (authRow as any).enclavePinHash ?? null;
      }
    }

    // Verify clearance token (from OTP email reset flow)
    if (clientClearanceToken && clientClearanceTs) {
      const expectedToken = issueClearanceToken(userId, Number(clientClearanceTs));
      const isRecent = Date.now() - Number(clientClearanceTs) < 15 * 60 * 1000;
      try {
        const expectedBuf = Buffer.from(expectedToken, 'hex');
        const clientBuf = Buffer.from(clientClearanceToken, 'hex');
        if (
          isRecent &&
          expectedBuf.length === clientBuf.length &&
          crypto.timingSafeEqual(expectedBuf, clientBuf)
        ) {
          // Authorized via OTP clearance token — proceed with reset
          await performPinReset(userId, dbTable, dbId);
          return NextResponse.json({ success: true, message: 'Enclave PIN reset successfully.' });
        }
      } catch {}
      return NextResponse.json({ error: 'Forbidden: Invalid or expired clearance token.' }, { status: 403 });
    }

    // Verify current PIN
    if (currentPin) {
      if (!storedPinHash) {
        // No PIN to delete
        return NextResponse.json({ success: true, message: 'No PIN was set.' });
      }
      if (!/^\d{6}$/.test(currentPin)) {
        return NextResponse.json({ error: 'Current PIN must be exactly 6 digits.' }, { status: 400 });
      }
      const isValid = await verifyPin(userId, currentPin, storedPinHash);
      if (!isValid) {
        return NextResponse.json({ error: 'Forbidden: Current PIN is incorrect.' }, { status: 403 });
      }
      await performPinReset(userId, dbTable, dbId);
      return NextResponse.json({ success: true, message: 'Enclave PIN reset successfully.' });
    }

    // otpCode path — TODO[A-011]: Implement OTP code verification via email
    // For now, reject otpCode path until email OTP for PIN reset is implemented
    return NextResponse.json(
      { error: 'OTP-based PIN reset requires current PIN. Use PUT to set a new PIN after OTP verification.' },
      { status: 403 }
    );

  } catch (err: any) {
    console.error('[Enclave PIN] Delete error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

async function performPinReset(userId: string, dbTable: 'user' | 'authUser', dbId: string | null) {
  await prisma.user.update({
    where: { walletAddress: userId.toLowerCase() },
    data: { enclavePinHash: null, enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any,
  }).catch(async () => {
    if (dbTable === 'authUser' && dbId) {
      await prisma.authUser.update({
        where: { id: dbId },
        data: { enclavePinHash: null, enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any,
      }).catch(() => {});
    }
  });
}
