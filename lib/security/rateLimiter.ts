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
  const redis = await getRedisClient();
  const prefix = opts.prefix ?? 'rl';
  const redisKey = `${prefix}:${key}`;
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  const clearBefore = now - windowMs;

  try {
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
    // Fail open if Redis is unavailable — log and allow
    logger.error({ err }, 'Rate limiter Redis error — failing open');
    return { allowed: true, remaining: opts.max, resetAt: Math.floor((now + windowMs) / 1000) };
  }
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
 */
export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
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
