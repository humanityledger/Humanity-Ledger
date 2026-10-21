import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createAccessToken,
  createRefreshToken,
  setSessionCookies,
  generateFingerprint,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// ATOMIC REDIS RATE LIMITER (same helper pattern as send-code)
// ─────────────────────────────────────────────────────────────────────────────
let _redis: any = null;
function getRedis(): any | null {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({ url, token });
    return _redis;
  } catch {
    return null;
  }
}

const _memRl = new Map<string, number[]>();
function memRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now  = Date.now();
  const hits = (_memRl.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= limit) return false;
  _memRl.set(key, [...hits, now]);
  return true;
}

async function redisRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return memRateLimit(key, limit, windowSec * 1000);
  try {
    const count: number = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    return count <= limit;
  } catch {
    return memRateLimit(key, limit, windowSec * 1000);
  }
}

/**
 * Increment a counter and return its current value.
 * Used for progressive lockout logic (we need the exact count, not just allowed/denied).
 */
async function redisIncrement(key: string, windowSec: number): Promise<number> {
  const redis = getRedis();
  if (!redis) {
    // In-memory fallback — count hits manually
    const now  = Date.now();
    const hits = (_memRl.get(key) || []).filter(t => now - t < windowSec * 1000);
    hits.push(now);
    _memRl.set(key, hits);
    return hits.length;
  }
  try {
    const count: number = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    return count;
  } catch {
    return 1;
  }
}

/**
 * Immediately lock a key for `lockSec` seconds (used for progressive lockout).
 */
async function redisLockout(key: string, lockSec: number): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    // In-memory: set far-future expiry by filling the window with timestamps
    _memRl.set(key, Array.from({ length: 9999 }, () => Date.now()));
    return;
  }
  try {
    await redis.set(key, 9999, { ex: lockSec });
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-code
// Body: { email: string, code: string }
// Note: `isLogin` flag is intentionally removed — the server decides based on DB state.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip   = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // ── 1. Normalize & validate inputs ───────────────────────────────────────
    const rawEmail: unknown = body?.email;
    const rawCode:  unknown = body?.code;

    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json({ error: 'Valid email and 6-digit code are required' }, { status: 400 });
    }
    const email = rawEmail.toLowerCase().trim();
    const emailRegex = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
    if (!emailRegex.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Valid email and 6-digit code are required' }, { status: 400 });
    }

    // Code must be exactly 6 ASCII digits — no SQL injection surface, no letter tricks
    if (!rawCode || typeof rawCode !== 'string' || !/^[0-9]{6}$/.test(rawCode)) {
      return NextResponse.json({ error: 'Valid email and 6-digit code are required' }, { status: 400 });
    }
    const code = rawCode;

    // ── 2. Atomic rate limiting — 3 layers ───────────────────────────────────

    // 2a. Global guard: max 30 verify attempts per IP per 5 min
    //     (stops subnet-level distributed brute force)
    const ipAllowed = await redisRateLimit(`verify_code:ip:${ip}`, 30, 5 * 60);
    if (!ipAllowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // 2b. Per-email guard: max 5 attempts per email per 15 minutes
    //     (stops targeted single-account brute force regardless of IP rotation)
    const emailAttempts = await redisIncrement(`verify_code:email:${email}`, 15 * 60);
    const EMAIL_ATTEMPT_LIMIT = 5;
    if (emailAttempts > EMAIL_ATTEMPT_LIMIT) {
      // Lockout this email for 15 minutes and invalidate all its codes
      await redisLockout(`verify_code:email:${email}`, 15 * 60);
      // Cascade: invalidate all outstanding codes so even if lockout is cleared,
      // the code window has expired
      const lockedUser = await (prisma.authUser as any).findUnique({ where: { email } });
      if (lockedUser) {
        await (prisma as any).verificationCode.updateMany({
          where: { userId: lockedUser.id, used: false },
          data:  { used: true },
        });
      }
      console.warn(`[Auth/verify-code] Email lockout triggered for ${email.replace(/(.{2})(.*)(@.*)/, '$1***$3')} after ${emailAttempts} failed attempts`);
      return NextResponse.json(
        { error: 'Too many failed attempts. This code has been invalidated. Please request a new one after 15 minutes.' },
        { status: 429 }
      );
    }

    // ── 3. Lookup user (normalized email) ────────────────────────────────────
    const user = await (prisma.authUser as any).findUnique({
      where: { email },
    });

    if (!user) {
      // Identical response to invalid code → prevents email enumeration
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    // ── 4. Lookup verification code (check SHA-256 hash or plaintext fallback - B-013) ──
    const crypto = await import('crypto');
    const inputHash = crypto.createHash('sha256').update(code).digest('hex');

    const verificationCode = await (prisma as any).verificationCode.findFirst({
      where: {
        userId:    user.id,
        code:      { in: [inputHash, code] },
        used:      false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationCode) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    // ── 5. Consume code immediately (mark used) ───────────────────────────────
    await (prisma as any).verificationCode.update({
      where: { id: verificationCode.id },
      data:  { used: true },
    });

    // ── 6. Mark user as verified (idempotent) ─────────────────────────────────
    if (!user.verified) {
      await (prisma.authUser as any).update({
        where: { id: user.id },
        data:  { verified: true },
      });
    }

    // ── 7. Issue session — server-side decision only (no client flag) ─────────
    const userAgent = request.headers.get('user-agent')  || '';
    const ipAddr    = request.headers.get('x-forwarded-for')
                   || request.headers.get('x-real-ip')
                   || 'unknown';

    const fingerprint  = generateFingerprint(userAgent, ipAddr);
    const accessToken  = await createAccessToken(user.id, user.email, fingerprint);
    const refreshToken = await createRefreshToken(user.id, user.email, fingerprint);

    // Secure httpOnly session cookies
    await setSessionCookies(accessToken, refreshToken);

    // ── 8. Return authenticated response ─────────────────────────────────────
    const isProd = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id:    user.id,
        email: user.email,
        name:  user.name ?? null,
      },
    });

    // Clear failed-attempt counter on success
    const redis = getRedis();
    if (redis) {
      try { await redis.del(`verify_code:email:${email}`); } catch { /* ignore */ }
    } else {
      _memRl.delete(`verify_code:email:${email}`);
    }

    const emailMasked = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    console.log(`[Auth/verify-code] Session issued for ${emailMasked}`);

    return response;

  } catch (error: any) {
    console.error('[Auth/verify-code] Unexpected error:', error?.message);
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
}
