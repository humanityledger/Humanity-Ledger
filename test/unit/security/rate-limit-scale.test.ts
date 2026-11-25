import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { BoundedEdgeRateLimiter, buildCgnatClientKey } from '@/lib/security/edgeRateLimit';
import { DEFAULT_RESTRICTED_COUNTRIES, isCountryRestricted, parseRestrictedCountries } from '@/lib/security/geoPolicy';
import {
  _clearLocalRateLimitWindowsForTests,
  checkRateLimit,
  getLocalRateLimitWindowCount,
} from '@/lib/security/rateLimiter';

describe('Scale 3M Phase 3: Edge LRU rate limiting, CGNAT, geo policy, health & TURN cache', () => {
  beforeEach(() => {
    _clearLocalRateLimitWindowsForTests();
  });

  afterEach(() => {
    delete process.env.GEOBLOCK_RESTRICTED_COUNTRIES;
    delete process.env.REDIS_REQUIRED_IN_CLUSTER;
    delete process.env.CLOUDFLARE_TURN_KEY_ID;
    delete process.env.CLOUDFLARE_TURN_API_TOKEN;
    vi.restoreAllMocks();
  });

  it('caps BoundedEdgeRateLimiter at maxEntries via LRU eviction and sweeps expired entries', () => {
    const limiter = new BoundedEdgeRateLimiter(5, 1_000, 100);
    const t0 = 10_000;
    for (let i = 0; i < 12; i += 1) {
      const res = limiter.check(`key-${i}`, 5, t0);
      expect(res.allowed).toBe(true);
    }
    expect(limiter.size).toBe(5);

    // Enforces limit on surviving MRU keys
    for (let j = 0; j < 4; j += 1) {
      expect(limiter.check('key-11', 5, t0).allowed).toBe(true);
    }
    const blocked = limiter.check('key-11', 5, t0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);

    // Expires entries cleanly once window passes
    expect(limiter.purgeExpired(t0 + 1_001)).toBe(5);
    expect(limiter.size).toBe(0);
  });

  it('isolates distinct devices behind the same mobile CGNAT IP while collapsing headerless clients', () => {
    const k1 = buildCgnatClientKey('198.51.100.10', 'Mozilla/5.0 iPhone', 'en-US');
    const k2 = buildCgnatClientKey('198.51.100.10', 'Mozilla/5.0 Android', 'es-ES');
    const kPlain = buildCgnatClientKey('198.51.100.10', null, null);

    expect(k1).toMatch(/^198\.51\.100\.10:[a-z0-9]+$/);
    expect(k2).toMatch(/^198\.51\.100\.10:[a-z0-9]+$/);
    expect(k1).not.toBe(k2);
    expect(kPlain).toBe('198.51.100.10');
  });

  it('enforces bounded 50,000 LRU cap in local rateLimiter fallback under key flood', async () => {
    vi.resetModules();
    vi.doMock('@/lib/redis', () => ({
      getRedisClient: vi.fn(async () => {
        throw new Error('redis down');
      }),
    }));
    const rlMod = await import('@/lib/security/rateLimiter');
    rlMod._clearLocalRateLimitWindowsForTests();

    for (let i = 0; i < 50_050; i += 1) {
      await rlMod.checkRateLimit(`flood-${i}`, { max: 5, windowSec: 60, prefix: 'test' });
    }
    expect(rlMod.getLocalRateLimitWindowCount()).toBeLessThanOrEqual(50_000);
    vi.doUnmock('@/lib/redis');
  });

  it('resolves configurable geo geofencing countries cleanly', () => {
    expect(parseRestrictedCountries(undefined)).toEqual([...DEFAULT_RESTRICTED_COUNTRIES]);
    expect(parseRestrictedCountries('off')).toEqual([]);
    expect(parseRestrictedCountries('none')).toEqual([]);
    expect(parseRestrictedCountries('us, kp; ir invalid XX1')).toEqual(['US', 'KP', 'IR']);
    expect(isCountryRestricted('fr', 'US,RU')).toBe(false);
    expect(isCountryRestricted('us', 'US,RU')).toBe(true);
    expect(isCountryRestricted('us', 'off')).toBe(false);
  });

  it('flags multiReplicaWarning in /api/health when REDIS_REQUIRED_IN_CLUSTER is set without Redis', async () => {
    vi.resetModules();
    process.env.REDIS_REQUIRED_IN_CLUSTER = 'true';
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        $queryRaw: vi.fn(async () => [{ migration_name: '20261125220000_scale_3m_indexes' }]),
      },
    }));
    vi.doMock('@/lib/redis/client', () => ({
      checkRedisHealth: vi.fn(async () => ({ ok: false, mode: 'mock' })),
      isRedisRequiredInCluster: () => true,
    }));
    vi.doMock('@/lib/storage/chat-attachment-store', () => ({
      isR2Enabled: () => true,
    }));

    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cluster.redisRequired).toBe(true);
    expect(body.cluster.multiReplicaWarning).toBe(true);
    expect(body.services.storage.mode).toBe('r2');

    vi.doUnmock('@/lib/prisma');
    vi.doUnmock('@/lib/redis/client');
    vi.doUnmock('@/lib/storage/chat-attachment-store');
  });

  it('shares Cloudflare TURN credentials across replicas via Redis cache', async () => {
    vi.resetModules();
    process.env.CLOUDFLARE_TURN_KEY_ID = 'cfkey_12345678';
    process.env.CLOUDFLARE_TURN_API_TOKEN = 'cftoken_secret';
    const redisKV = new Map<string, string>();
    const safeRedisGet = vi.fn(async (k: string) => redisKV.get(k) ?? null);
    const safeRedisSet = vi.fn(async (k: string, v: string) => {
      redisKV.set(k, v);
      return true;
    });

    vi.doMock('@/lib/redis/client', () => ({ safeRedisGet, safeRedisSet }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          iceServers: [
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u1', credential: 'c1' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const mod1 = await import('@/app/api/calls/ice/route');
    const res1 = await mod1.GET();
    const body1 = await res1.json();
    expect(body1.source).toBe('cloudflare');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(safeRedisSet).toHaveBeenCalledTimes(1);

    // Simulate second fresh replica (module reloaded -> L1 empty, reads L2 Redis)
    vi.resetModules();
    vi.doMock('@/lib/redis/client', () => ({ safeRedisGet, safeRedisSet }));
    const mod2 = await import('@/app/api/calls/ice/route');
    const res2 = await mod2.GET();
    const body2 = await res2.json();
    expect(body2.source).toBe('cloudflare');
    expect(body2.iceServers.length).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.doUnmock('@/lib/redis/client');
  });

  it('is still callable directly for checkRateLimit baseline smoke check', async () => {
    const res = await checkRateLimit('unit-smoke', { max: 2, windowSec: 60, prefix: 't' });
    expect(res.allowed).toBe(true);
    expect(new NextRequest('https://ledgerchat.org/').url).toBe('https://ledgerchat.org/');
  });
});
