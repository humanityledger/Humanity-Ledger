import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';

/**
 * Redis sliding-window rate limiter.
 *
 * Uses a sorted set (ZSET) per key where members are random IDs and scores are timestamps.
 * On each request: prune old entries, count remaining, add new entry.
 */

interface RateLimitOptions {
  /** Max requests allowed in the window */
  max: number;
  /** Window size in seconds */
  windowSec: number;
  /** Key prefix for namespacing (e.g., 'auth', 'msg', 'pin') */
  prefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch seconds
}

/**
 * Check rate limit for a key (IP, userId, etc.)
 */
export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const prefix = opts.prefix ?? 'rl';
  const redisKey = `${prefix}:${key}`;
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  const clearBefore = now - windowMs;

  try {
    // getRedisClient() used to be called above this try. The catch below is
    // documented as failing open when Redis is unavailable, but it could never
    // see a connection failure: the throw happened before the try was entered,
    // so the error propagated into the caller instead. Routes that call this
    // without a try of their own — /api/siwe/nonce among them — answered 500
    // with no Redis configured, which made sign-in impossible to complete on a
    // fresh local setup. Acquiring the client inside the try makes the
    // fail-open behaviour do what its comment always claimed.
    const redis = await getRedisClient();
    const pipeline = redis.pipeline();
    // Remove entries older than the window
    pipeline.zremrangebyscore(redisKey, '-inf', clearBefore);
    // Count entries in window
    pipeline.zcard(redisKey);
    // Add current request
    pipeline.zadd(redisKey, now, `${now}-${Math.random().toString(36).slice(2)}`);
    // Set expiry so keys auto-clean
    pipeline.expire(redisKey, opts.windowSec * 2);

    const results = await pipeline.exec();
    const count = (results?.[1]?.[1] as number) ?? 0;

    const allowed = count < opts.max;
    const remaining = Math.max(0, opts.max - count - 1);
    const resetAt = Math.floor((now + windowMs) / 1000);

    return { allowed, remaining, resetAt };
  } catch (err) {
    // Redis is unavailable. This used to fail open, which meant every limit
    // in the app (sign-in codes, PIN attempts, message sending) disappeared
    // whenever Redis did. Fall back to a per-process window instead: weaker
    // than a shared one across replicas, but a limit nonetheless.
    if (!warnedNoRedis) {
      warnedNoRedis = true;
      logger.warn({ err }, 'Rate limiter: Redis unavailable, using per-process limits');
    }
    return localLimit(redisKey, opts.max, windowMs, now);
  }
}

let warnedNoRedis = false;
const localWindows = new Map<string, number[]>();

function localLimit(key: string, max: number, windowMs: number, now: number): RateLimitResult {
  const hits = (localWindows.get(key) ?? []).filter(t => now - t < windowMs);
  const allowed = hits.length < max;
  if (allowed) hits.push(now);
  localWindows.set(key, hits);
  if (localWindows.size > 50_000) {
    for (const [k, v] of localWindows) {
      if (!v.length || now - v[v.length - 1] > windowMs) localWindows.delete(k);
    }
  }
  return { allowed, remaining: Math.max(0, max - hits.length), resetAt: Math.floor((now + windowMs) / 1000) };
}

/**
 * Rate limit presets per action type.
 */
export const RATE_LIMITS = {
  auth:        { max: 10,  windowSec: 60,   prefix: 'rl:auth' },
  message:     { max: 60,  windowSec: 60,   prefix: 'rl:msg' },
  community:   { max: 5,   windowSec: 3600, prefix: 'rl:com' },
  pin:         { max: 8,   windowSec: 300,  prefix: 'rl:pin' },
  global:      { max: 200, windowSec: 60,   prefix: 'rl:global' },
} as const;

/**
 * Extract client IP from request (works behind Railway proxy).
 *
 * The FIRST X-Forwarded-For entry is whatever the client sent, so keying a
 * limit on it lets anyone reset their limit by sending a new header. The
 * LAST entry is the one our own proxy appended. Same rule as middleware.ts.
 */
export function getClientIP(req: NextRequest | Request): string {
  const hops = (req.headers.get('x-forwarded-for') || '').split(',').map(h => h.trim()).filter(Boolean);
  return hops[hops.length - 1] || req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Higher-order middleware that applies rate limiting.
 * Returns 429 with Retry-After header if limit exceeded.
 */
export function withRateLimit(
  handler: (req: NextRequest, ctx?: any) => Promise<NextResponse>,
  action: keyof typeof RATE_LIMITS
) {
  return async (req: NextRequest, ctx?: any): Promise<NextResponse> => {
    const ip = getClientIP(req);
    const opts = RATE_LIMITS[action];
    const result = await checkRateLimit(ip, opts);

    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: result.resetAt },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.resetAt - Math.floor(Date.now() / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const response = await handler(req, ctx);
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    return response;
  };
}
