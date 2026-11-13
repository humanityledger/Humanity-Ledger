import { NextRequest } from 'next/server';

/** F-08c: the account route never invents an Aztec address or a node state. */
describe('GET /api/aztec/account', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const call = async () => {
    const { GET } = await import('@/app/api/aztec/account/route');
    const res = await GET(new NextRequest('http://localhost/api/aztec/account?address=0x' + '1'.repeat(40)));
    return (await res.json()) as Record<string, unknown>;
  };

  it('returns no Aztec address: it is derived on the device, never by the server', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    const body = await call();
    expect(body.aztecAddress).toBeNull();
    expect(body).not.toHaveProperty('explorerUrl');
    expect(body).not.toHaveProperty('registered');
  });

  it('a node that does not answer is unavailable, with no data', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    const body = await call();
    expect(body.rpcStatus).toBe('unavailable');
    expect(body.mainnetData).toBeNull();
  });

  it('a node answering an error or an empty result is unavailable', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), { status: 200 })) as unknown as typeof fetch;
    const body = await call();
    expect(body.rpcStatus).toBe('unavailable');
    expect(body.mainnetData).toBeNull();
  });

  it('a node on another L1 chain is a mismatch, never live', async () => {
    globalThis.fetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      const { method } = JSON.parse(String(init?.body));
      const result = method === 'node_getBlockNumber' ? 10 : { nodeVersion: '6.0.0', l1ChainId: 11155111, rollupVersion: 1, l1ContractAddresses: {} };
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200 });
    }) as unknown as typeof fetch;
    const body = await call();
    expect(body.rpcStatus).toBe('mismatch');
  });

  it('the source no longer contains the fabricated derivation or hard-coded blocks', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('app/api/aztec/account/route.ts', 'utf8');
    expect(src).not.toMatch(/@ts-nocheck/);
    expect(src).not.toMatch(/createHash\('sha256'\)/);
    expect(src).not.toMatch(/1821685239|v5\.mainnet|rpcStatus = 'live'; \/\/ Force/);
  });
});
