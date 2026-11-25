import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

describe('Scale 3M Phase 4: SSE multiplexing, single-flight catchup, non-blocking queue & polling backoff', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('multiplexes N concurrent /api/ledger-stream clients onto a single Redis subscriber and stops on abort', async () => {
    const createSubClient = vi.fn(() => ({
      on: vi.fn(),
      subscribe: vi.fn(async () => 1),
      unsubscribe: vi.fn(async () => 0),
      quit: vi.fn(async () => 'OK'),
    }));
    const createRedisClient = vi.fn(() => ({
      __isMock: false,
      xread: vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return null;
      }),
      quit: vi.fn(async () => 'OK'),
      disconnect: vi.fn(),
    }));
    const findMany = vi.fn(async () => []);

    vi.doMock('@/lib/redis/client', () => ({
      redisClient: { __isMock: false },
      createSubClient,
      createRedisClient,
      safeRedisGet: vi.fn(async () => null),
      safeRedisSet: vi.fn(async () => undefined),
    }));
    vi.doMock('@/lib/prisma', () => ({
      prisma: { ledgerActivity: { findMany } },
      prismaRead: { ledgerActivity: { findMany } },
    }));

    const { ledgerStreamHub, _resetCatchupCacheForTests } = await import('@/lib/sse/ledgerStreamHub');
    const { GET } = await import('@/app/api/ledger-stream/route');
    _resetCatchupCacheForTests();
    await ledgerStreamHub.stop();

    const controllers = Array.from({ length: 10 }, () => new AbortController());
    try {
      const responses = await Promise.all(
        controllers.map((ctrl) =>
          GET(new NextRequest('https://ledgerchat.org/api/ledger-stream', { signal: ctrl.signal })),
        ),
      );

      for (const res of responses) {
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/event-stream');
      }

      // Wait a tick for async hub start()
      await new Promise((r) => setTimeout(r, 20));
      const stats = ledgerStreamHub.getStats();
      expect(stats.subscribers).toBe(10);
      expect(stats.authSubscribeCalls).toBe(1);
      expect(createSubClient).toHaveBeenCalledTimes(1);
      expect(createRedisClient).toHaveBeenCalledTimes(1);
      // Catch-up query coalesced across all 10 simultaneous connections
      expect(findMany).toHaveBeenCalledTimes(1);
    } finally {
      for (const ctrl of controllers) ctrl.abort();
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(ledgerStreamHub.getStats().subscribers).toBe(0);
    expect(ledgerStreamHub.getStats().running).toBe(false);

    vi.doUnmock('@/lib/redis/client');
    vi.doUnmock('@/lib/prisma');
  });

  it('multiplexes concurrent listeners on the same chat channel onto one shared poller and delivers local pushes', async () => {
    const { chatStreamHub } = await import('@/lib/sse/chatStreamHub');
    const chan = '0xalice_0xbob';
    const seen1: string[] = [];
    const seen2: string[] = [];

    const unsub1 = chatStreamHub.subscribe(chan, (m) => seen1.push(m.content));
    const unsub2 = chatStreamHub.subscribe(chan, (m) => seen2.push(m.content));

    expect(chatStreamHub.getStats(chan).listeners).toBe(2);
    expect(chatStreamHub.getStats(chan).hasTimer).toBe(true);

    chatStreamHub.publishLocal(chan, {
      id: 'm1',
      sender: '0xalice',
      content: 'hello',
      sentAt: new Date().toISOString(),
      _score: Date.now(),
    });
    expect(seen1).toEqual(['hello']);
    expect(seen2).toEqual(['hello']);

    unsub1();
    expect(chatStreamHub.getStats(chan).listeners).toBe(1);
    expect(chatStreamHub.getStats(chan).hasTimer).toBe(true);

    unsub2();
    expect(chatStreamHub.getStats(chan).listeners).toBe(0);
    expect(chatStreamHub.getStats(chan).hasTimer).toBe(false);
  });

  it('keeps /api/chat/queue GET read-only on normal hits without synchronous deleteMany lock', async () => {
    const findMany = vi.fn(async () => [{ id: '1', sender: '0x1', recipient: '0x2', content: 'hi' }]);
    const deleteMany = vi.fn(async () => ({ count: 0 }));

    vi.doMock('@/lib/security/requireWallet', () => ({
      requireWallet: vi.fn(async () => ({ walletAddress: '0x2222222222222222222222222222222222222222' })),
    }));
    vi.doMock('@/lib/prisma', () => ({
      prisma: { pendingChatMessage: { findMany, deleteMany } },
      prismaRead: { pendingChatMessage: { findMany, deleteMany } },
    }));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const { GET } = await import('@/app/api/chat/queue/route');
    const res = await GET(new NextRequest('https://ledgerchat.org/api/chat/queue'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.messages).toHaveLength(1);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).not.toHaveBeenCalled();

    vi.doUnmock('@/lib/security/requireWallet');
    vi.doUnmock('@/lib/prisma');
  });

  it('uses >= 10s interval for liveRtt probe baseline to curb fleet /api/ping traffic', async () => {
    const { PROBE_INTERVAL_MS, MAX_PROBE_BACKOFF_MS } = await import('@/lib/chat/liveRtt');
    expect(PROBE_INTERVAL_MS).toBeGreaterThanOrEqual(10_000);
    expect(MAX_PROBE_BACKOFF_MS).toBeGreaterThanOrEqual(PROBE_INTERVAL_MS);
  });
});
