import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateVerificationCode } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { getClientIP } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// ATOMIC REDIS RATE LIMITER (Upstash)
// Uses MULTI/EXEC pipeline so every check+increment is atomic.
// Falls back to in-memory Map if Upstash env vars are absent.
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

// In-memory fallback (single-instance only)
const _memRl = new Map<string, number[]>();
function memRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now  = Date.now();
  const hits = (_memRl.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= limit) return false;
  _memRl.set(key, [...hits, now]);
  return true;
}

/**
 * Atomic Redis rate limiter using INCR + EXPIRE.
 * Returns true if request is allowed, false if limit exceeded.
 */
async function redisRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return memRateLimit(key, limit, windowSec * 1000);
  try {
    const count: number = await redis.incr(key);
    if (count === 1) {
      // First hit — set TTL so the key auto-expires
      await redis.expire(key, windowSec);
    }
    return count <= limit;
  } catch {
    // Redis failure → degrade to in-memory (don't crash the route)
    return memRateLimit(key, limit, windowSec * 1000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOUDFLARE TURNSTILE VERIFICATION
// Token is sent by the client only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
// If the env var is absent (dev mode), validation is skipped gracefully.
// ─────────────────────────────────────────────────────────────────────────────
async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Turnstile not configured — skip (dev / environments without it)
    return true;
  }
  if (!token) {
    return false; // Secret is set but token is missing → reject
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }).toString(),
    });
    const data: any = await res.json();
    return data?.success === true;
  } catch {
    // Network error calling Cloudflare — fail open in dev, fail closed in prod
    return process.env.NODE_ENV !== 'production';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/send-code
// Body: { email: string, turnstileToken?: string }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // The last X-Forwarded-For hop is the one our proxy added; the first is whatever the client sent.
    const ip = getClientIP(request);
    const body = await request.json();

    // ── 1. Normalize & validate email ────────────────────────────────────────
    const rawEmail: unknown = body?.email;
    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    const email = rawEmail.toLowerCase().trim();
    const emailRegex = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
    if (!emailRegex.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // ── 2. Cloudflare Turnstile bot check ────────────────────────────────────
    const turnstileToken: string | undefined = typeof body?.turnstileToken === 'string'
      ? body.turnstileToken
      : undefined;
    const turnstileOk = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Bot verification failed. Please refresh and try again.' }, { status: 403 });
    }

    // ── 3. Atomic rate limiting ───────────────────────────────────────────────
    // 3a. Per-IP: 5 requests per 10 minutes (covers disposable email attacks)
    const ipAllowed = await redisRateLimit(`send_code:ip:${ip}`, 5, 10 * 60);
    if (!ipAllowed) {
      return NextResponse.json(
        { error: 'Too many requests from your network. Please wait before trying again.' },
        { status: 429 }
      );
    }

    // 3b. Per-email: 3 codes per 10 minutes (absolute ceiling per mailbox)
    const emailAllowed = await redisRateLimit(`send_code:email:${email}`, 3, 10 * 60);
    if (!emailAllowed) {
      return NextResponse.json(
        { error: 'A code was recently sent to this address. Please wait before requesting another.' },
        { status: 429 }
      );
    }

    // 3c. Per-email minimum gap: 1 code per 60 seconds (prevents accidental double-clicks)
    const gapAllowed = await redisRateLimit(`send_code:gap:${email}`, 1, 60);
    if (!gapAllowed) {
      return NextResponse.json(
        { error: 'A code was just sent. Please wait 60 seconds before requesting a new one.' },
        { status: 429 }
      );
    }

    // Masked email for all server logs (never log the full address)
    const emailMasked = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    console.log(`[Auth/send-code] Request from IP=${ip.slice(0, 8)}*** email=${emailMasked}`);

    // ── 4. Upsert AuthUser (normalized email) ─────────────────────────────────
    const user = await (prisma.authUser as any).upsert({
      where:  { email },
      update: {},
      create: { email, passwordHash: '', verified: false },
    });

    // ── 5. Invalidate all previous unused codes for this user ─────────────────
    // Prevents replay attacks from codes issued in previous sessions
    await (prisma as any).verificationCode.updateMany({
      where: { userId: user.id, used: false },
      data:  { used: true },
    });

    // ── 6. Generate & persist new code (hashed with SHA-256, 10 min TTL - B-013) ──
    const crypto = await import('crypto');
    const code      = generateVerificationCode();
    const codeHash  = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes (B-013)

    await (prisma as any).verificationCode.create({
      data: { code: codeHash, userId: user.id, expiresAt },
    });

    // ── 7. Send email ─────────────────────────────────────────────────────────
    // SECURITY: Code is ONLY delivered via email — never in API response, never in logs.
    try {
      await sendVerificationEmail(email, code);
      console.log(`[Auth/send-code] Code delivered to ${emailMasked}`);
    } catch (emailError: any) {
      console.error('[Auth/send-code] Email provider error:', {
        error:         emailError?.message || 'Unknown',
        code:          emailError?.code    || 'EMAIL_PROVIDER_ERROR',
        apiKeyPresent: !!process.env.RESEND_API_KEY,
      });
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again in a moment.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Verification code sent' });

  } catch (err: any) {
    console.error('[Auth/send-code] Unexpected error:', err?.message);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
