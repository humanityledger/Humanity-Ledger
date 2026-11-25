/**
 * Edge-safe bounded LRU sliding-window rate limiter, CGNAT client key derivation,
 * and optional Upstash Redis REST distributed check for hot auth/presign/search routes.
 * Pure Web APIs only (no Node built-ins).
 */

export const MAX_EDGE_RL_ENTRIES = 50_000;
export const EDGE_RL_WINDOW_MS = 60_000;

export interface EdgeWindowEntry {
  count: number;
  resetTime: number;
}

export interface EdgeRateLimitCheck {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Bounded LRU fixed/sliding window map for Edge isolates:
 * - Touching a key moves it to MRU via delete + set (Map preserves insertion order)
 * - Periodic deterministic sweeps purge expired keys every `sweepInterval` checks
 * - Strict cap at `maxEntries` evicts oldest entries first so Edge isolate memory stays bounded.
 */
export class BoundedEdgeRateLimiter {
  private readonly store = new Map<string, EdgeWindowEntry>();
  private ops = 0;

  constructor(
    readonly maxEntries: number = MAX_EDGE_RL_ENTRIES,
    readonly windowMs: number = EDGE_RL_WINDOW_MS,
    private readonly sweepInterval: number = 1024,
  ) {}

  get size(): number {
    return this.store.size;
  }

  check(key: string, limit: number, now: number = Date.now()): EdgeRateLimitCheck {
    this.ops += 1;
    if (this.ops % this.sweepInterval === 0) {
      this.purgeExpired(now);
    }

    const existing = this.store.get(key);
    if (!existing || now >= existing.resetTime) {
      // Delete before insert so refreshed entry becomes MRU.
      if (existing) {
        this.store.delete(key);
      }
      this.evictIfFull();
      const entry: EdgeWindowEntry = { count: 1, resetTime: now + this.windowMs };
      this.store.set(key, entry);
      return {
        allowed: 1 <= limit,
        count: 1,
        remaining: Math.max(0, limit - 1),
        retryAfterSec: Math.max(1, Math.ceil(this.windowMs / 1000)),
      };
    }

    // Touch to maintain LRU recency order.
    this.store.delete(key);
    existing.count += 1;
    this.store.set(key, existing);

    const remaining = Math.max(0, limit - existing.count);
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetTime - now) / 1000));
    return {
      allowed: existing.count <= limit,
      count: existing.count,
      remaining,
      retryAfterSec,
    };
  }

  purgeExpired(now: number = Date.now()): number {
    let removed = 0;
    for (const [k, v] of this.store) {
      if (now >= v.resetTime) {
        this.store.delete(k);
        removed += 1;
      }
    }
    return removed;
  }

  private evictIfFull(): void {
    while (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) break;
      this.store.delete(oldestKey);
    }
  }
}

/**
 * Lightweight deterministic non-cryptographic FNV-1a 32-bit hash suitable for
 * distinguishing browsers/devices behind carrier-grade NAT (mobile CGNAT) without PII storage.
 */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Derive an Edge rate-limit client key combining IP with a compact device hint
 * (User-Agent + Accept-Language) when present so one abusive user on mobile CGNAT
 * hits their own tight bucket before exhausting the broader shared IP subnet ceiling.
 */
export function buildCgnatClientKey(
  clientIp: string,
  userAgent: string | null | undefined,
  acceptLang?: string | null | undefined,
): string {
  const ip = clientIp.trim() || 'unknown';
  const ua = (userAgent || '').trim().slice(0, 160);
  const lang = (acceptLang || '').trim().slice(0, 32);
  if (!ua && !lang) return ip;
  return `${ip}:${fnv1aHash(`${ua}|${lang}`)}`;
}

/**
 * Optional Upstash Redis REST pipeline rate-limit check for Next.js Edge Middleware.
 * Uses fixed 60s window counters (INCR + EXPIRE on first hit) via single HTTP pipeline
 * so distributed Edge instances share enforcement on critical unauthenticated endpoints
 * (SIWE auth, presign, search, Aztec relay). Fails open immediately if unconfigured or slow.
 */
export async function checkUpstashEdgeLimit(
  key: string,
  limit: number,
  windowSec: number = 60,
): Promise<{ ok: boolean; count?: number; degraded?: boolean }> {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!restUrl || !restToken) {
    return { ok: true };
  }

  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const redisKey = `hl:edge_rl:${bucket}:${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 350);

  try {
    const res = await fetch(`${restUrl.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, windowSec + 5, 'NX'],
      ]),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: true, degraded: true };
    }
    const data = (await res.json()) as Array<{ result?: unknown }>;
    const count = Number(data?.[0]?.result ?? 0);
    if (!Number.isFinite(count) || count <= 0) {
      return { ok: true, degraded: true };
    }
    return { ok: count <= limit, count };
  } catch {
    return { ok: true, degraded: true };
  } finally {
    clearTimeout(timer);
  }
}
