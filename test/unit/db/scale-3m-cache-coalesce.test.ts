import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const CALLER = '0x' + '1'.repeat(40);
const PEER = '0x' + '2'.repeat(40);

describe('Phase C: Hot-path Redis pipelining, L1 single-flight coalescing & read-first replicas', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('safeRedisMGet, safeRedisSetMany and safeRedisDel batch operations round-trip cleanly in fallback mode', async () => {
    const { safeRedisMGet, safeRedisSetMany, safeRedisDel } = await import('@/lib/redis/client');
    await safeRedisSetMany([
      { key: 'test:batch:a', value: 'va', ttlSec: 30 },
      { key: 'test:batch:b', value: 'vb', ttlSec: 30 },
    ]);
    const got = await safeRedisMGet(['test:batch:a', 'test:batch:missing', 'test:batch:b']);
    expect(got).toEqual(['va', null, 'vb']);
    await safeRedisDel('test:batch:a', 'test:batch:b');
    const afterDel = await safeRedisMGet(['test:batch:a', 'test:batch:b']);
    expect(afterDel).toEqual([null, null]);
  });

  it('caches /api/chat/stories per author via MGET and invalidates immediately on POST', async () => {
    const memRedis = new Map<string, string>();
    let storyFindManyCalls = 0;
    let contactFindManyCalls = 0;

    vi.doMock('@/lib/redis/client', () => ({
      safeRedisGet: vi.fn(async (k: string) => memRedis.get(k) ?? null),
      safeRedisSet: vi.fn(async (k: string, v: string) => { memRedis.set(k, v); }),
      safeRedisMGet: vi.fn(async (keys: string[]) => keys.map((k) => memRedis.get(k) ?? null)),
      safeRedisSetMany: vi.fn(async (entries: Array<{ key: string; value: string }>) => {
        for (const e of entries) memRedis.set(e.key, e.value);
      }),
      safeRedisDel: vi.fn(async (...keys: string[]) => {
        for (const k of keys) memRedis.delete(k);
      }),
    }));
    vi.doMock('@/lib/security/resolveCaller', () => ({
      resolveVerifiedCaller: vi.fn(async () => CALLER),
    }));
    const mockDb = {
      chatContact: {
        findMany: vi.fn(async () => {
          contactFindManyCalls++;
          return [{ owner: PEER }];
        }),
      },
      story: {
        findMany: vi.fn(async () => {
          storyFindManyCalls++;
          return [{
            id: 's1',
            authorAddress: PEER,
            contentUrl: 'hello scale',
            mediaType: 'text',
            audience: [],
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          }];
        }),
        count: vi.fn(async () => 0),
        create: vi.fn(async ({ data }: any) => ({ ...data, createdAt: new Date().toISOString() })),
      },
    };
    vi.doMock('@/lib/prisma', () => ({ prisma: mockDb, prismaRead: mockDb }));

    const { GET, POST } = await import('@/app/api/chat/stories/route');

    const r1 = await GET(new NextRequest('https://ledgerchat.org/api/chat/stories'));
    expect(r1.status).toBe(200);
    expect(contactFindManyCalls).toBe(1);
    expect(storyFindManyCalls).toBe(1);

    // Repeat GET hits both reverse-authors Redis key and MGET author stories key (0 extra DB queries)
    const r2 = await GET(new NextRequest('https://ledgerchat.org/api/chat/stories'));
    expect(r2.status).toBe(200);
    expect(contactFindManyCalls).toBe(1);
    expect(storyFindManyCalls).toBe(1);

    // Author posts a new story -> invalidates caller's author cache key
    const p1 = await POST(new NextRequest('https://ledgerchat.org/api/chat/stories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contentUrl: 'fresh post', mediaType: 'text' }),
    }));
    expect(p1.status).toBe(200);
    expect(memRedis.has(`stories:by_author:v1:${CALLER}`)).toBe(false);
  });

  it('caches /api/notifications/inbox on replica and invalidates on POST read-all', async () => {
    const memRedis = new Map<string, string>();
    let findManyCalls = 0;

    vi.doMock('@/lib/redis/client', () => ({
      safeRedisGet: vi.fn(async (k: string) => memRedis.get(k) ?? null),
      safeRedisSet: vi.fn(async (k: string, v: string) => { memRedis.set(k, v); }),
      safeRedisDel: vi.fn(async (...keys: string[]) => {
        for (const k of keys) memRedis.delete(k);
      }),
    }));
    vi.doMock('@/lib/security/verifiedCaller', () => ({
      getVerifiedCaller: vi.fn(async () => CALLER),
    }));
    const readDb = {
      user: { findFirst: vi.fn(async () => ({ id: 'u1' })) },
      notification: {
        findMany: vi.fn(async () => {
          findManyCalls++;
          return [{ id: 'n1', read: false, title: 'Hi' }];
        }),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    vi.doMock('@/lib/prisma', () => ({ prisma: readDb, prismaRead: readDb }));

    const { GET, POST } = await import('@/app/api/notifications/inbox/route');
    const g1 = await GET(new NextRequest('https://ledgerchat.org/api/notifications/inbox'));
    expect((await g1.json()).unreadCount).toBe(1);
    expect(findManyCalls).toBe(1);

    const g2 = await GET(new NextRequest('https://ledgerchat.org/api/notifications/inbox'));
    expect((await g2.json()).unreadCount).toBe(1);
    expect(findManyCalls).toBe(1);

    await POST(new NextRequest('https://ledgerchat.org/api/notifications/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }));
    expect(memRedis.has(`notif:inbox:v1:${CALLER}`)).toBe(false);
  });

  it('coalesces concurrent /api/stats/live cache misses into 1 DB round-trip via prismaRead', async () => {
    let countCalls = 0;
    const readDb = {
      user: {
        count: vi.fn(async () => {
          countCalls++;
          await new Promise((r) => setTimeout(r, 20));
          return 42;
        }),
      },
      chatUsername: { count: vi.fn(async () => 7) },
      visitorTally: {
        groupBy: vi.fn(async () => [{ tz: 'Europe/Madrid', _sum: { count: 10 } }]),
        aggregate: vi.fn(async () => ({ _sum: { count: 3 } })),
      },
    };
    const writeDb = {
      user: { count: vi.fn(async () => { throw new Error('Should not query primary on live stats'); }) },
    };

    vi.doMock('@/lib/prisma', () => ({ prisma: writeDb, prismaRead: readDb }));
    vi.doMock('@/lib/redis', () => ({
      safeRedisGet: vi.fn(async () => null),
      safeRedisSet: vi.fn(async () => undefined),
    }));
    vi.doMock('@/lib/protocol/read', () => ({
      readBlockNumber: vi.fn(async () => 12345),
    }));

    const { GET } = await import('@/app/api/stats/live/route');
    const [a, b, c] = await Promise.all([GET(), GET(), GET()]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(c.status).toBe(200);
    expect(a.headers.get('CDN-Cache-Control')).toContain('public');
    expect(countCalls).toBe(1);
  });

  it('reads existing user balance via prismaRead without executing primary upsert write', async () => {
    let upsertCalls = 0;
    const readDb = {
      user: {
        findUnique: vi.fn(async () => ({ creditsBalance: 500 })),
      },
    };
    const writeDb = {
      user: {
        findUnique: vi.fn(async () => ({ creditsBalance: 500 })),
        upsert: vi.fn(async () => { upsertCalls++; return { creditsBalance: 2500 }; }),
      },
    };

    vi.doMock('@/lib/prisma', () => ({ prisma: writeDb, prismaRead: readDb }));
    vi.doMock('@/lib/session', () => ({ getSession: vi.fn(async () => ({ userId: CALLER })) }));
    vi.doMock('@/lib/aztec/zk-identity', () => ({ isOwner: () => true }));

    const { GET } = await import('@/app/api/aztec/balance/route');
    const res = await GET(new Request(`https://ledgerchat.org/api/aztec/balance?aztecAddress=${CALLER}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe('500.00');
    expect(upsertCalls).toBe(0);
  });
});
