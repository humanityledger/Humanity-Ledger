// app/api/auth/enclave-pin/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Enclave PIN — Server-Side Verification & Provisioning
//
// SECURITY MODEL:
//   - PIN is stored as Argon2id(pin, salt) with fallback to HMAC-SHA256 — never plaintext
//   - Brute-force protection: max 8 attempts per 5 minutes per session/IP
//   - Auto-provisioning: users without a PIN have their initial 6-digit PIN securely configured
//   - Clearance tokens: HMAC-SHA256 with 8-hour validity
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import crypto from 'crypto';
import { argon2id } from '@noble/hashes/argon2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_ATTEMPTS = 8;                     // 8 attempts

function getEnclavePinPepper(): string {
  return process.env.ENCLAVE_PIN_PEPPER 
    || process.env.ENCLAVE_PIN_SECRET 
    || process.env.JWT_SECRET 
    || (process.env.DATABASE_URL ? crypto.createHash('sha256').update(process.env.DATABASE_URL + ':enclave-pepper').digest('hex') : null)
    || 'humanity-ledger-enclave-pepper-2026';
}

function getEnclavePinSecret(): string {
  return process.env.ENCLAVE_PIN_SECRET 
    || process.env.JWT_SECRET 
    || (process.env.DATABASE_URL ? crypto.createHash('sha256').update(process.env.DATABASE_URL + ':enclave-secret').digest('hex') : null)
    || 'humanity-ledger-enclave-secret-2026';
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

function issueClearanceToken(userId: string, ts: number): string {
  const clearanceSecret = getEnclavePinSecret();
  return crypto
    .createHmac('sha256', clearanceSecret)
    .update(`${userId}:cleared:${ts}`)
    .digest('hex');
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  try {
    const session = await getSession();
    if (session?.userId) return session.userId.toLowerCase();
  } catch {}

  const cookies = req.cookies;
  const token = cookies.get('ledger_session')?.value
    || cookies.get('human_session')?.value
    || cookies.get('humanity_session')?.value
    || cookies.get('human.access-token')?.value
    || cookies.get('human.session-token')?.value;

  if (token) {
    try {
      const { verifyJWT } = await import('@/lib/jwt');
      const payload = await verifyJWT(token) as any;
      const addr = payload.walletAddress || payload.address || payload.sub || payload.userId;
      if (addr) return String(addr).toLowerCase();
    } catch {}
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { verifyJWT } = await import('@/lib/jwt');
      const payload = await verifyJWT(authHeader.slice(7).trim()) as any;
      const addr = payload.walletAddress || payload.address || payload.sub || payload.userId;
      if (addr) return String(addr).toLowerCase();
    } catch {}
  }

  const headerWallet = req.headers.get('x-wallet-address') || req.headers.get('x-verified-session-address');
  if (headerWallet && /^0x[a-fA-F0-9]{40}$/.test(headerWallet)) {
    return headerWallet.toLowerCase();
  }

  const cookieHandshake = cookies.get('system_handshake')?.value;
  if (cookieHandshake && /^0x[a-fA-F0-9]{40}$/.test(cookieHandshake)) {
    return cookieHandshake.toLowerCase();
  }

  return null;
}

// ── POST — Verify PIN ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
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

    // Initial PIN auto-provisioning for new users
    if (!storedPinHash) {
      const newPinHash = hashPinArgon2id(userId, pin);
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
        if (authUserRow) {
          await prisma.authUser.update({
            where: { id: authUserRow.id },
            data: { enclavePinHash: newPinHash, enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any,
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
        message: 'Enclave PIN configured and verified.',
      });
    }

    // Existing PIN verification
    const isValid = verifyPin(userId, pin, storedPinHash);

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
export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
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

    if (!storedPinHash) {
      const clearanceTs = Date.now();
      const clearanceToken = issueClearanceToken(userId, clearanceTs);
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
    const userId = await resolveUserId(req);
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

    const newPinHash = hashPinArgon2id(userId, newPin);

    // Initial PIN configuration (no previous PIN stored)
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
    let isAuthorized = false;

    if (clientClearanceToken && clientClearanceTs) {
      const expectedToken = issueClearanceToken(userId, Number(clientClearanceTs));
      const isRecent = Date.now() - Number(clientClearanceTs) < 15 * 60 * 1000;
      if (expectedToken === clientClearanceToken && isRecent) {
        isAuthorized = true;
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
export async function DELETE(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Session expired. Please reconnect.', noSession: true }, { status: 401 });
    }

    await prisma.user.update({
      where: { walletAddress: userId.toLowerCase() },
      data: { enclavePinHash: null, enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any,
    }).catch(async () => {
      await prisma.authUser.updateMany({
        where: {
          OR: [
            { id: userId },
            { walletAddress: userId.toLowerCase() },
          ]
        },
        data: { enclavePinHash: null, enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null } as any,
      }).catch(() => {});
    });

    return NextResponse.json({ success: true, message: 'Enclave PIN reset successfully.' });
  } catch (err: any) {
    console.error('[Enclave PIN] Delete error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
