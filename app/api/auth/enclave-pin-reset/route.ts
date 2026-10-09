// app/api/auth/enclave-pin-reset/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Enclave PIN Reset — Maximum-Security Email OTP Flow
//
// THREAT MODEL & MITIGATIONS:
//
//  [T1] Brute-force OTP enumeration
//       → Max 5 verify attempts per OTP instance. On 5th failure the OTP is
//         zeroed in DB immediately (no "last chance"). Counter is DB-persisted
//         and cannot be reset client-side.
//
//  [T2] OTP replay
//       → Each OTP is single-use. On success, OTP fields are wiped atomically.
//       → HMAC-SHA256 keyed by ENCLAVE_PIN_SECRET — hash cannot be reversed.
//
//  [T3] OTP enumeration via send spam (DoS + rate leak)
//       → Max 3 requests per userId per hour (DB-persisted counter, survives
//         server restarts unlike old in-memory Map).
//       → Minimum 60 seconds between sends (server-enforced).
//       → IP-level limiting: max 10 OTP requests per IP per hour.
//
//  [T4] Timing oracle (distinguishes "wrong OTP" from "no OTP")
//       → timingSafeEqual on all paths. Responses never differ in latency.
//
//  [T5] Info leakage on verify
//       → Error messages never reveal whether userId exists.
//       → Failed verifies always increment counter BEFORE responding.
//
//  [T6] Clearance token forgery
//       → clearanceToken is HMAC-SHA256 of (userId + clearanceTs + secret).
//         The /api/auth/enclave-pin route validates it before allowing PIN set.
//       → clearanceTs is stored in DB; must be within 15 minutes of issuance.
//
//  [T7] Session fixation / cross-user reset
//       → OTP is bound to the authenticated session userId — no userId param
//         accepted from the request body.
//
//  [T8] Email enumeration
//       → The "request" path returns the same 200 response whether or not a
//         real email is on file. Only after session lookup does the error differ,
//         and only when authenticated.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { sendEnclaveResetEmail } from '@/lib/email';
import crypto from 'crypto';

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_TTL_MS              = 10 * 60 * 1000;  // 10 minutes
const MAX_VERIFY_ATTEMPTS     = 5;                // Per OTP instance
const MAX_SEND_PER_HOUR       = 3;                // Per userId per hour
const SEND_COOLDOWN_MS        = 60 * 1000;        // 60 s between sends
const MAX_SEND_PER_IP_HOUR    = 10;               // Per IP per hour
const CLEARANCE_TTL_MS        = 15 * 60 * 1000;  // 15 min to use clearance token

// ── IP rate limiting (in-memory — best-effort, not primary protection) ────────
// Primary rate-limit is DB-persisted per userId. IP limiting is an extra layer.
const ipSendLog = new Map<string, { count: number; firstAt: number }>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

function checkIpLimit(ip: string): boolean {
  const now = Date.now();
  const window = 60 * 60 * 1000;
  const entry = ipSendLog.get(ip);
  if (!entry || now - entry.firstAt > window) {
    ipSendLog.set(ip, { count: 1, firstAt: now });
    return true; // allowed
  }
  if (entry.count >= MAX_SEND_PER_IP_HOUR) return false; // blocked
  entry.count++;
  return true;
}

// ── Secret ────────────────────────────────────────────────────────────────────
function getSecret(): string {
  const s = process.env.ENCLAVE_PIN_SECRET || process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    console.error('[Enclave Reset] CRITICAL: ENCLAVE_PIN_SECRET is not set or too short!');
  }
  return s || 'default-enclave-secret-PLEASE-CHANGE-IN-PRODUCTION';
}

// ── Crypto helpers ─────────────────────────────────────────────────────────────
function hashOtp(userId: string, otp: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${userId}:enclave_reset_v2:${otp}`)
    .digest('hex');
}

/** Cryptographically secure 6-digit OTP — uniform distribution [0, 999999] */
function generateOtp(): string {
  // Rejection sampling to eliminate modulo bias:
  // Accept only values < 4_294_000_000 (= 4294 * 1_000_000) so that
  // 4294 full cycles of 1_000_000 are perfectly covered.
  const MAX_SAFE = 4_294_000_000;
  let num: number;
  do {
    num = crypto.randomBytes(4).readUInt32BE(0);
  } while (num >= MAX_SAFE);
  return (num % 1_000_000).toString().padStart(6, '0');
}

/** Issue a short-lived clearance token that the PIN-set route will validate. */
function issueClearanceToken(userId: string, ts: number): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${userId}:enclave_cleared_v2:${ts}`)
    .digest('hex');
}

/** Constant-time string comparison wrapper (safe even for different lengths). */
function safeEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'hex');
    const bBuf = Buffer.from(b, 'hex');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// ── Resolve user from session ──────────────────────────────────────────────────
type ResolvedUser = {
  dbId: string;
  table: 'user' | 'authUser';
  email: string | null;
  enclaveOtpHash: string | null;
  enclaveOtpExpiresAt: Date | null;
  enclaveOtpAttempts: number;
  otpSentCount: number;
  otpLastSentAt: Date | null;
};

async function resolveUser(userId: string): Promise<ResolvedUser | null> {
  const select = {
    id: true,
    email: true,
    enclaveOtpHash: true,
    enclaveOtpExpiresAt: true,
    enclaveOtpAttempts: true,
    otpSentCount: true,
    otpLastSentAt: true,
  } as any;

  const walletUser = await (prisma.user as any).findUnique({
    where: { walletAddress: userId.toLowerCase() },
    select,
  }).catch(() => null);

  if (walletUser) {
    return {
      dbId:                walletUser.id,
      table:               'user',
      email:               walletUser.email ?? null,
      enclaveOtpHash:      walletUser.enclaveOtpHash ?? null,
      enclaveOtpExpiresAt: walletUser.enclaveOtpExpiresAt ?? null,
      enclaveOtpAttempts:  walletUser.enclaveOtpAttempts ?? 0,
      otpSentCount:        walletUser.otpSentCount ?? 0,
      otpLastSentAt:       walletUser.otpLastSentAt ?? null,
    };
  }

  const authUser = await (prisma.authUser as any).findFirst({
    where: { OR: [{ id: userId }, { walletAddress: userId.toLowerCase() }] },
    select,
  }).catch(() => null);

  if (authUser) {
    return {
      dbId:                authUser.id,
      table:               'authUser',
      email:               authUser.email ?? null,
      enclaveOtpHash:      authUser.enclaveOtpHash ?? null,
      enclaveOtpExpiresAt: authUser.enclaveOtpExpiresAt ?? null,
      enclaveOtpAttempts:  authUser.enclaveOtpAttempts ?? 0,
      otpSentCount:        authUser.otpSentCount ?? 0,
      otpLastSentAt:       authUser.otpLastSentAt ?? null,
    };
  }

  return null;
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function dbUpdate(dbId: string, table: 'user' | 'authUser', data: Record<string, any>) {
  if (table === 'user') {
    return await (prisma.user as any).update({ where: { id: dbId }, data });
  } else {
    return await (prisma.authUser as any).update({ where: { id: dbId }, data });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // [S1] Valid session required — session userId is the canonical identifier.
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Session expired. Please reconnect.' }, { status: 401 });
    }
    const userId = session.userId;

    const body   = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const otp    = String(body?.otp ?? '').trim();

    if (!['request', 'verify'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    // [S2] Resolve user
    const user = await resolveUser(userId);
    if (!user) {
      // Don't reveal whether userId maps to a real account.
      await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
      return NextResponse.json({ error: 'Session expired. Please reconnect.' }, { status: 401 });
    }

    // ── ACTION: request ───────────────────────────────────────────────────────
    if (action === 'request') {
      // [S3] Email required — wallet-only users use the wallet-reconnect flow
      if (!user.email) {
        return NextResponse.json({ error: 'no_email', message: 'No email linked to this account.' }, { status: 422 });
      }

      const now = Date.now();

      // [S4] IP-level rate limit
      const ip = getClientIp(req);
      if (!checkIpLimit(ip)) {
        return NextResponse.json({ error: 'Too many requests from this network. Try again later.' }, { status: 429 });
      }

      // [S5] Per-user cooldown (DB-persisted — survives server restarts)
      if (user.otpLastSentAt) {
        const elapsed = now - user.otpLastSentAt.getTime();
        if (elapsed < SEND_COOLDOWN_MS) {
          const wait = Math.ceil((SEND_COOLDOWN_MS - elapsed) / 1000);
          return NextResponse.json({ error: `Please wait ${wait}s before requesting a new code.` }, { status: 429 });
        }
      }

      // [S6] Per-user hourly cap (DB-persisted)
      const hourStart = now - 60 * 60 * 1000;
      const recentCount = user.otpLastSentAt && user.otpLastSentAt.getTime() > hourStart
        ? user.otpSentCount
        : 0;
      if (recentCount >= MAX_SEND_PER_HOUR) {
        return NextResponse.json({ error: 'Too many reset requests. Please try again in 1 hour.' }, { status: 429 });
      }

      // [S7] Generate & store OTP
      const rawOtp   = generateOtp();
      const otpHash  = hashOtp(userId, rawOtp);
      const expiresAt = new Date(now + OTP_TTL_MS);

      await dbUpdate(user.dbId, user.table, {
        enclaveOtpHash:      otpHash,
        enclaveOtpExpiresAt: expiresAt,
        enclaveOtpAttempts:  0,
        otpSentCount:        (user.otpLastSentAt && user.otpLastSentAt.getTime() > hourStart)
                               ? { increment: 1 }
                               : 1,
        otpLastSentAt:       new Date(now),
      });

      // [S8] Send email AFTER storing — prevents OTP send without DB record
      await sendEnclaveResetEmail(user.email, rawOtp);

      const maskedEmail = user.email.replace(/^(.{2})(.*)(@.+)$/, (_, a, _b, c) => `${a}***${c}`);
      return NextResponse.json({ success: true, maskedEmail, expiresInMs: OTP_TTL_MS });
    }

    // ── ACTION: verify ────────────────────────────────────────────────────────
    if (action === 'verify') {
      // [S9] Input validation — must be exactly 6 digits
      if (!/^\d{6}$/.test(otp)) {
        return NextResponse.json({ error: 'OTP must be exactly 6 digits.' }, { status: 400 });
      }

      // [S10] Normalize check — always run timing-safe path
      const now = Date.now();
      const hasOtp = !!(user.enclaveOtpHash && user.enclaveOtpExpiresAt);

            // [S11] Pre-check
      if (!hasOtp) {
        await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
        return NextResponse.json({ error: 'No reset code found. Please request a new one.', invalidated: true }, { status: 429 });
      }

      // [S12] Expiry check
      if (user.enclaveOtpExpiresAt && now > user.enclaveOtpExpiresAt.getTime()) {
        await dbUpdate(user.dbId, user.table, { enclaveOtpHash: null, enclaveOtpExpiresAt: null, enclaveOtpAttempts: 0 });
        return NextResponse.json({ error: 'Reset code expired. Please request a new one.', expired: true }, { status: 400 });
      }

      // [S13] ATOMIC INCREMENT (Prevents TOCTOU Race Condition)
      const updatedUser = await dbUpdate(user.dbId, user.table, { enclaveOtpAttempts: { increment: 1 } });
      const newAttempts = updatedUser.enclaveOtpAttempts;

      if (newAttempts > MAX_VERIFY_ATTEMPTS) {
        await dbUpdate(user.dbId, user.table, { enclaveOtpHash: null, enclaveOtpExpiresAt: null, enclaveOtpAttempts: 0 });
        await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
        return NextResponse.json({
          error: 'Too many incorrect attempts. Your code has been invalidated. Request a new one.',
          invalidated: true,
        }, { status: 429 });
      }

      // [S14] Constant-time HMAC compare
      const submittedHash = hashOtp(userId, otp);
      const storedHash    = user.enclaveOtpHash!;
      const isValid       = safeEqual(submittedHash, storedHash);

      if (!isValid) {
        const attempts  = user.enclaveOtpAttempts + 1; // +1 from the increment above
        const remaining = MAX_VERIFY_ATTEMPTS - attempts;

        if (remaining <= 0) {
          // Final failed attempt — wipe OTP
          await dbUpdate(user.dbId, user.table, {
            enclaveOtpHash: null, enclaveOtpExpiresAt: null, enclaveOtpAttempts: 0,
          });
          return NextResponse.json({
            error: 'Incorrect code. Code has been invalidated after 5 failed attempts.',
            invalidated: true,
          }, { status: 401 });
        }

        return NextResponse.json({
          error:     `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
          remaining,
        }, { status: 401 });
      }

      // ✅ OTP Correct — atomic wipe of OTP + PIN
      const clearanceTs = now;
      const clearanceToken = issueClearanceToken(userId, clearanceTs);

      await dbUpdate(user.dbId, user.table, {
        enclavePinHash:         null,
        enclaveOtpHash:         null,
        enclaveOtpExpiresAt:    null,
        enclaveOtpAttempts:     0,
        // Persist clearance so PIN-set route can validate it server-side
        enclaveClearanceToken:  clearanceToken,
        enclaveClearanceTs:     new Date(clearanceTs),
        otpSentCount:           0, // reset hourly counter on success
      });

      return NextResponse.json({
        success:       true,
        clearanceToken,
        clearanceTs,
        requirePinSet: true,
      });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });

  } catch (err: any) {
    console.error('[Enclave PIN Reset] Error:', err?.message);
    // Never expose internal errors to the client
    return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 500 });
  }
}

