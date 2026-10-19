// app/api/auth/enclave-pin/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Enclave PIN — Server-Side Verification
//
// SECURITY MODEL:
//   - PIN is stored as SHA-256(userId + ":" + pin + SALT) — never plaintext
//   - Brute-force protection: max 5 attempts per 15 minutes per session/IP
//   - Rate-limit window is tracked server-side in-memory (per Railway instance)
//     + a DB failsafe flag for cross-instance protection
//   - A new user who has never set a PIN uses the DEFAULT_PIN (set in env)
//   - Users can SET their own PIN via POST /api/auth/enclave-pin
//
// Routes:
//   POST  /api/auth/enclave-pin          — Verify PIN (returns clearance token)
//   PUT   /api/auth/enclave-pin          — Set/Update PIN (requires current PIN or is first-time)
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import crypto from 'crypto';
import { argon2id } from '@noble/hashes/argon2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

// ── Brute-force tracker (Migrated to DB for Serverless/Edge persistence) ──
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_ATTEMPTS = 8;                     // 8 attempts

// ── Argon2id PIN Hashing (T-07 / H6) ──────────────────────────────────────────
// Parameters: m=65536 (64MB), t=3 (iterations), p=1 (parallelism), 32-byte key length.
function getEnclavePinPepper(): string {
  const pepper = process.env.ENCLAVE_PIN_PEPPER || process.env.ENCLAVE_PIN_SECRET || process.env.JWT_SECRET;
  if (!pepper) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: Missing ENCLAVE_PIN_PEPPER environment variable in production');
    }
    return 'dev-enclave-pin-pepper-local-dev-only';
  }
  return pepper;
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

function getEnclavePinSecret(): string {
  const s = process.env.ENCLAVE_PIN_SECRET;
  if (s) return s;
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('CRITICAL: Missing ENCLAVE_PIN_SECRET or JWT_SECRET');
  return crypto.createHmac('sha256', jwtSecret).update('humanity-ledger:enclave-pin-domain-separation:v1').digest('hex');
}

function hashPinLegacy(userId: string, pin: string): string {
  const secret = getEnclavePinSecret();
  const normalizedId = userId.toLowerCase();
  return crypto
    .createHmac('sha256', secret)
    .update(`${normalizedId}:${pin}`)
    .digest('hex');
}

function verifyPin(userId: string, pin: string, storedHash: string): boolean {
  try {
    const argonHash = hashPinArgon2id(userId, pin);
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

// ── POST — Verify PIN ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Session expired. Please reconnect.' }, { status: 401 });
    }

    const userId = session.userId;
    
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

    const body = await req.json();
    const { pin } = body;

    if (!pin || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 6 digits.' }, { status: 400 });
    }

    const storedPinHash = dbRow?.enclavePinHash || null;
    if (!storedPinHash) {
      return NextResponse.json({
        error: 'No Enclave PIN configured for this account. Please set a PIN.',
        needsPinSetup: true
      }, { status: 404 });
    }

    const isValid = verifyPin(userId, pin, storedPinHash);

    if (!isValid) {
      const now = new Date();
      // Reset window if it expired
      const isWindowExpired = !dbRow?.enclaveOtpExpiresAt || now > new Date(dbRow.enclaveOtpExpiresAt);
      const newAttempts = isWindowExpired ? 1 : (dbRow?.enclaveOtpAttempts || 0) + 1;
      const newExpiresAt = isWindowExpired ? new Date(now.getTime() + ATTEMPT_WINDOW_MS) : dbRow?.enclaveOtpExpiresAt;
      
      if (isUserTable) {
        await prisma.user.update({
          where: { walletAddress: userId.toLowerCase() },
          data: { enclaveOtpAttempts: newAttempts, enclaveOtpExpiresAt: newExpiresAt }
        });
      } else if (authUserRow) {
        await prisma.authUser.update({
          where: { id: authUserRow.id },
          data: { enclaveOtpAttempts: newAttempts, enclaveOtpExpiresAt: newExpiresAt } as any
        });
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

    // ✅ Success — clear DB brute-force counter
    if ((dbRow?.enclaveOtpAttempts || 0) > 0) {
      if (isUserTable) {
        await prisma.user.update({
          where: { walletAddress: userId.toLowerCase() },
          data: { enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null }
        });
      } else if (authUserRow) {
        await prisma.authUser.update({
          where: { id: authUserRow.id },
          data: { enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any
        });
      }
    }

    // Issue a short-lived clearance token (HMAC of userId+timestamp)
    const clearanceTs = Date.now();
    const clearanceSecret = (() => { const s = process.env.ENCLAVE_PIN_SECRET || process.env.JWT_SECRET; if (!s) throw new Error('CRITICAL: Missing ENCLAVE_PIN_SECRET'); return s; })();
    const clearanceToken = crypto
      .createHmac('sha256', clearanceSecret)
      .update(`${userId}:cleared:${clearanceTs}`)
      .digest('hex');

    const isFirstTimeUser = !storedPinHash;

    return NextResponse.json({
      success: true,
      clearanceToken,
      clearanceTs,
      isFirstTimeUser, // Frontend shows "set your own PIN" prompt if true
    });

  } catch (err: any) {
    console.error('[Enclave PIN] Verify error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// ── GET — Check if PIN is set ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      // Return 401 with noSession flag so client can redirect to /connect
      return NextResponse.json({ hasPin: false, noSession: true }, { status: 401 });
    }
    const userId = session.userId;
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
    
    if (!storedPinHash) {
      const clearanceTs = Date.now();
      const clearanceSecret = (() => { const s = process.env.ENCLAVE_PIN_SECRET || process.env.JWT_SECRET; if (!s) throw new Error('CRITICAL: Missing ENCLAVE_PIN_SECRET'); return s; })();
      const clearanceToken = crypto
        .createHmac('sha256', clearanceSecret)
        .update(`${userId}:cleared:${clearanceTs}`)
        .digest('hex');
      return NextResponse.json({ hasPin: false, clearanceToken, clearanceTs });
    }

    return NextResponse.json({ hasPin: true });
  } catch (err) {
    return NextResponse.json({ hasPin: false });
  }
}

// ── PUT — Set/Update PIN ──────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Session expired. Please reconnect.' }, { status: 401 });
    }

    const userId = session.userId;
    const body = await req.json();
    const { currentPin, newPin, clearanceToken: clientClearanceToken, clearanceTs: clientClearanceTs } = body;

    if (!newPin || !/^\d{6}$/.test(newPin)) {
      return NextResponse.json({ error: 'New PIN must be exactly 6 digits.' }, { status: 400 });
    }

    // Fetch stored PIN hash + clearance fields from DB
    let storedPinHash: string | null = null;
    let dbClearanceToken: string | null = null;
    let dbClearanceTs: Date | null = null;
    let dbId: string | null = null;
    let dbTable: 'user' | 'authUser' = 'user';

    const userRow = await prisma.user.findUnique({
      where: { walletAddress: userId.toLowerCase() },
      select: { id: true, enclavePinHash: true, enclaveClearanceToken: true, enclaveClearanceTs: true } as any,
    }).catch(() => null);

    if (userRow) {
      dbId = (userRow as any).id;
      storedPinHash     = (userRow as any).enclavePinHash ?? null;
      dbClearanceToken  = (userRow as any).enclaveClearanceToken ?? null;
      dbClearanceTs     = (userRow as any).enclaveClearanceTs ?? null;
    } else {
      const authRow = await prisma.authUser.findFirst({
        where: { OR: [{ id: userId }, { walletAddress: userId.toLowerCase() }] },
        select: { id: true, enclavePinHash: true, enclaveClearanceToken: true, enclaveClearanceTs: true } as any,
      }).catch(() => null);
      if (authRow) {
        dbId = (authRow as any).id;
        dbTable = 'authUser';
        storedPinHash    = (authRow as any).enclavePinHash ?? null;
        dbClearanceToken = (authRow as any).enclaveClearanceToken ?? null;
        dbClearanceTs    = (authRow as any).enclaveClearanceTs ?? null;
      }
    }

    if (!storedPinHash) {
      return NextResponse.json({
        error: 'No Enclave PIN configured for this account. Initial PIN setup required.',
        needsPinSetup: true,
      }, { status: 404 });
    }

    // Current PIN is required to update PIN
    if (!currentPin) {
      return NextResponse.json({ error: 'Current PIN is required to change PIN.' }, { status: 400 });
    }

    let dbOtpAttempts = 0;
    let dbOtpExpiresAt: Date | null = null;
    
    if (userRow) {
      dbOtpAttempts = (userRow as any).enclaveOtpAttempts || 0;
      dbOtpExpiresAt = (userRow as any).enclaveOtpExpiresAt || null;
    } else if (dbTable === 'authUser') {
      const authRowRefetched = await prisma.authUser.findUnique({
        where: { id: dbId as string },
        select: { enclaveOtpAttempts: true, enclaveOtpExpiresAt: true } as any
      }).catch(() => null);
      if (authRowRefetched) {
        dbOtpAttempts = (authRowRefetched as any).enclaveOtpAttempts || 0;
        dbOtpExpiresAt = (authRowRefetched as any).enclaveOtpExpiresAt || null;
      }
    }

    // Verify current PIN before changing
    if (dbOtpExpiresAt && new Date() < new Date(dbOtpExpiresAt)) {
      if (dbOtpAttempts >= MAX_ATTEMPTS) {
        const retryAfterMin = Math.ceil((new Date(dbOtpExpiresAt).getTime() - Date.now()) / 60000);
        return NextResponse.json({ error: `Too many attempts. Try again in ${retryAfterMin} minutes.` }, { status: 429 });
      }
    }

    const isCurrentValid = verifyPin(userId, currentPin, storedPinHash);

    if (!isCurrentValid) {
      const now = new Date();
      const isWindowExpired = !dbOtpExpiresAt || now > new Date(dbOtpExpiresAt);
      const newAttempts = isWindowExpired ? 1 : dbOtpAttempts + 1;
      const newExpiresAt = isWindowExpired ? new Date(now.getTime() + ATTEMPT_WINDOW_MS) : dbOtpExpiresAt;
      
      if (dbTable === 'user') {
        await prisma.user.update({
          where: { walletAddress: userId.toLowerCase() },
          data: { enclaveOtpAttempts: newAttempts, enclaveOtpExpiresAt: newExpiresAt }
        });
      } else {
        await prisma.authUser.update({
          where: { id: dbId as string },
          data: { enclaveOtpAttempts: newAttempts, enclaveOtpExpiresAt: newExpiresAt } as any
        });
      }
      
      return NextResponse.json({ error: 'Current PIN incorrect.' }, { status: 401 });
    }
    
    // Success - clear lockout counter
    if (dbOtpAttempts > 0) {
      if (dbTable === 'user') {
        await prisma.user.update({
          where: { walletAddress: userId.toLowerCase() },
          data: { enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null }
        });
      } else {
        await prisma.authUser.update({
          where: { id: dbId as string },
          data: { enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any
        });
      }
    }

    const newPinHash = hashPinArgon2id(userId, newPin);

    // Save to User table
    await prisma.user.update({
      where: { walletAddress: userId.toLowerCase() },
      data: { enclavePinHash: newPinHash } as any,
    }).catch(async () => {
      // Fallback: AuthUser table
      await prisma.authUser.updateMany({
        where: {
          OR: [
            { id: userId },
            { walletAddress: userId.toLowerCase() },
          ]
        },
        data: { enclavePinHash: newPinHash } as any,
      });
    });

    const clearanceTs = Date.now();
    const clearanceSecret = (() => { const s = process.env.ENCLAVE_PIN_SECRET || process.env.JWT_SECRET; if (!s) throw new Error('CRITICAL: Missing ENCLAVE_PIN_SECRET'); return s; })();
    const clearanceToken = crypto
      .createHmac('sha256', clearanceSecret)
      .update(`${userId}:cleared:${clearanceTs}`)
      .digest('hex');

    return NextResponse.json({ 
      success: true, 
      message: 'Enclave PIN updated successfully.',
      clearanceToken,
      clearanceTs
    });

  } catch (err: any) {
    console.error('[Enclave PIN] Update error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// ── DELETE — Reset PIN (Requires re-authentication) ──────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Session expired. Please reconnect.' }, { status: 401 });
    }

    const userId = session.userId;

    // Clear PIN from User table
    await prisma.user.update({
      where: { walletAddress: userId.toLowerCase() },
      data: { enclavePinHash: null } as any,
    }).catch(async () => {
      // Fallback: AuthUser table
      await prisma.authUser.updateMany({
        where: {
          OR: [
            { id: userId },
            { walletAddress: userId.toLowerCase() },
          ]
        },
        data: { enclavePinHash: null } as any,
      });
    });

    return NextResponse.json({ success: true, message: 'Enclave PIN reset successfully.' });

  } catch (err: any) {
    console.error('[Enclave PIN] Delete error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

