/**
 * D-029 — XMTP Rate Limiter (client-side)
 * Respects XMTP limits: 20,000 reads / 3,000 writes per 5 minutes.
 * Use before making XMTP API calls to avoid 429 errors.
 */

export interface XmtpLimitConfig {
  count: number;
  windowMs: number;
}

const XMTP_LIMITS: Record<'reads' | 'writes', XmtpLimitConfig> = {
  reads:  { count: 20_000, windowMs: 5 * 60 * 1000 },
  writes: { count: 3_000,  windowMs: 5 * 60 * 1000 },
};

interface Counter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, Counter>();

/**
 * Check if an XMTP operation is within rate limits.
 * Returns true if allowed, false if rate limited.
 */
export function checkXmtpLimit(type: 'reads' | 'writes'): boolean {
  const limit = XMTP_LIMITS[type];
  const now = Date.now();
  let rec = counters.get(type);

  if (!rec || now > rec.resetAt) {
    rec = { count: 1, resetAt: now + limit.windowMs };
  } else {
    rec.count++;
  }

  counters.set(type, rec);
  return rec.count <= limit.count;
}

/**
 * Returns the milliseconds until the current window resets.
 * Use this to implement exponential backoff.
 */
export function getXmtpBackoffMs(type: 'reads' | 'writes'): number {
  const rec = counters.get(type);
  if (!rec) return 0;
  const remaining = rec.resetAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Get current usage stats for monitoring.
 */
export function getXmtpUsage(): Record<'reads' | 'writes', { used: number; limit: number; resetsIn: number }> {
  const now = Date.now();
  return {
    reads: {
      used: counters.get('reads')?.count ?? 0,
      limit: XMTP_LIMITS.reads.count,
      resetsIn: Math.max(0, (counters.get('reads')?.resetAt ?? now) - now),
    },
    writes: {
      used: counters.get('writes')?.count ?? 0,
      limit: XMTP_LIMITS.writes.count,
      resetsIn: Math.max(0, (counters.get('writes')?.resetAt ?? now) - now),
    },
  };
}
