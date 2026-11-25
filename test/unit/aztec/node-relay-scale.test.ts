import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  _resetRelayCircuitForTests,
  getPublicRelayCacheSpec,
  recordUpstreamFailure,
  recordUpstreamSuccess,
  rewireJsonRpcId,
  selectHealthyUpstreams,
} from '@/lib/aztec/node-relay';

describe('Scale 3M Phase 5: Aztec node relay circuit-breaker, single-flight coalescing & safe public caching', () => {
  beforeEach(() => {
    _resetRelayCircuitForTests();
  });

  afterEach(() => {
    delete process.env.AZTEC_NODE_RELAY_UPSTREAMS;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('caches and coalesces only immutable/public read calls while never caching tx submissions or private calls', () => {
    expect(getPublicRelayCacheSpec(JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'aztec_getNodeInfo', params: [] })))
      .toMatchObject({ method: 'aztec_getNodeInfo', reqId: 10 });
    expect(getPublicRelayCacheSpec(JSON.stringify({ jsonrpc: '2.0', id: 'a', method: 'aztec_getBlock', params: [42] })))
      .toMatchObject({ method: 'aztec_getBlock', reqId: 'a' });

    // Dynamic 'latest', batches, private queries, and txs must bypass cache
    expect(getPublicRelayCacheSpec(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'aztec_getBlock', params: ['latest'] }))).toBeNull();
    expect(getPublicRelayCacheSpec(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'aztec_sendTx', params: ['0x1'] }))).toBeNull();
    expect(getPublicRelayCacheSpec(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'aztec_getNullifierMembershipWitness', params: [1, '0x0'] }))).toBeNull();
    expect(getPublicRelayCacheSpec(JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'aztec_getNodeInfo' }]))).toBeNull();

    expect(JSON.parse(rewireJsonRpcId('{"jsonrpc":"2.0","id":1,"result":{"v":1}}', 99)).id).toBe(99);
  });

  it('demotes failing upstream after 3 failures via circuit breaker and restores on success', () => {
    const up1 = 'https://node1.example';
    const up2 = 'https://node2.example';
    const now = 100_000;

    recordUpstreamFailure(up1, now);
    recordUpstreamFailure(up1, now);
    expect(selectHealthyUpstreams([up1, up2], now)).toEqual([up1, up2]);

    recordUpstreamFailure(up1, now);
    expect(selectHealthyUpstreams([up1, up2], now)).toEqual([up2, up1]);

    // After cooldown expires, up1 becomes eligible again
    expect(selectHealthyUpstreams([up1, up2], now + 31_000)).toEqual([up1, up2]);

    recordUpstreamSuccess(up1);
    expect(selectHealthyUpstreams([up1, up2], now)).toEqual([up1, up2]);
  });

  it('coalesces simultaneous /api/aztec/node calls for aztec_getNodeInfo and rewires caller IDs without touching cache for aztec_sendTx', async () => {
    vi.resetModules();
    process.env.AZTEC_NODE_RELAY_UPSTREAMS = 'https://primary.example,https://backup.example';

    vi.doMock('@/lib/security/rateLimiter', () => ({
      checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 100, resetAt: Math.floor(Date.now() / 1000) + 60 })),
      getClientIP: () => '203.0.113.9',
    }));
    vi.doMock('@/lib/redis/client', () => ({
      safeRedisGet: vi.fn(async () => null),
      safeRedisSet: vi.fn(async () => undefined),
    }));

    let fetchCount = 0;
    let txCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const parsed = JSON.parse(String(init?.body || '{}'));
      if (parsed.method === 'aztec_getNodeInfo') {
        fetchCount += 1;
        await new Promise((r) => setTimeout(r, 20));
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: { nodeVersion: '6.0.0' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      txCount += 1;
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: `tx-${txCount}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const { POST } = await import('@/app/api/aztec/node/route');
    const makeReq = (id: number | string, method: string) =>
      new NextRequest('https://ledgerchat.org/api/aztec/node', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-verified-session-address': '0x1111111111111111111111111111111111111111',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params: [] }),
      });

    // Fire 8 concurrent aztec_getNodeInfo calls -> single-flight coalesced to 1 upstream request!
    const responses = await Promise.all(
      [1, 2, 3, 4, 5, 6, 7, 8].map((id) => POST(makeReq(id, 'aztec_getNodeInfo'))),
    );
    expect(fetchCount).toBe(1);
    for (let i = 0; i < responses.length; i += 1) {
      expect(responses[i].status).toBe(200);
      const body = await responses[i].json();
      expect(body.id).toBe(i + 1);
      expect(body.result.nodeVersion).toBe('6.0.0');
    }

    // Immediate next hit comes from L1 memory cache (still fetchCount === 1)
    const cached = await POST(makeReq('cached-9', 'aztec_getNodeInfo'));
    expect(cached.headers.get('x-relay-cache')).toBe('HIT');
    expect((await cached.json()).id).toBe('cached-9');
    expect(fetchCount).toBe(1);

    // aztec_sendTx NEVER caches or coalesces
    await Promise.all([POST(makeReq(10, 'aztec_sendTx')), POST(makeReq(11, 'aztec_sendTx'))]);
    expect(txCount).toBe(2);

    vi.doUnmock('@/lib/security/rateLimiter');
    vi.doUnmock('@/lib/redis/client');
  });
});
