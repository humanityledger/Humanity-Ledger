/**
 * Unified Redis Cache Layer
 * Provider-agnostic cache via ioredis (supports Upstash, Railway, Fly, local).
 * Requires REDIS_URL in env. Without it, cache silently degrades (passthrough mode).
 */
import { redisClient } from '@/lib/redis/client';

export const CacheTTL = {
  PORTFOLIO_BALANCE: 30,     // 30 seconds
  NFT_METADATA: 300,         // 5 minutes
  TOKEN_PRICES: 10,          // 10 seconds
  TRANSACTION_HISTORY: 60,   // 1 minute
  LEDGER_ACTIVITY: 120,       // 2 minutes
  MARKET_DATA: 5,            // 5 seconds
} as const;

interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

/** Try to get value from cache. Returns null on miss or error. */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisClient.get(key);
    if (raw) {
      console.log(`[Cache HIT] ${key}`);
      return JSON.parse(raw) as T;
    }
    return null;
  } catch (error: any) {
    console.warn('[Cache] getCached error:', error.message);
    return null;
  }
}

/** Write a value to cache with TTL in seconds. Silent on failure. */
export async function setCached<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
  const ttl = options.ttl || 60;
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
    console.log(`[Cache SET] ${key} (TTL: ${ttl}s)`);
  } catch (error: any) {
    console.warn('[Cache] setCached error:', error.message);
  }
}

/** Remove key from cache. Silent on failure. */
export async function deleteCached(key: string): Promise<void> {
  try {
    await redisClient.del(key);
    console.log(`[Cache DEL] ${key}`);
  } catch (error: any) {
    console.warn('[Cache] deleteCached error:', error.message);
  }
}

/**
 * Stale-while-revalidate pattern.
 * Returns cache hit immediately, else runs fetcher, stores result and returns it.
 */
export async function withCache<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
  const cached = await getCached<T>(key);
  if (cached !== null) return cached;

  console.log(`[Cache MISS] ${key}`);
  const data = await fetcher();
  await setCached(key, data, options);
  return data;
}

/** Helpers for generating typed, collision-safe cache keys */
export const userCacheKey     = (userId: string, resource: string) => `user:${userId}:${resource}`;
export const addressCacheKey  = (address: string, resource: string) => `address:${address.toLowerCase()}:${resource}`;
export const marketCacheKey   = (symbol: string, timeframe?: string) => timeframe ? `market:${symbol}:${timeframe}` : `market:${symbol}`;

/** Wipe all keys for a given user. Useful after profile changes. */
export async function invalidateUserCache(userId: string): Promise<void> {
  try {
    const keys = await redisClient.keys(`user:${userId}:*`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`[Cache] Invalidated ${keys.length} keys for user ${userId}`);
    }
  } catch (error: any) {
    console.warn('[Cache] invalidateUserCache error:', error.message);
  }
}
