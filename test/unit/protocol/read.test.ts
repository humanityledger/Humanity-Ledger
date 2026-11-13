import { createHash } from 'node:crypto';
import { canonicalJson } from '@/lib/protocol/metrics';

describe('readSnapshot / buildReport', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.resetModules();
  });

  it('reads the committed mainnet record and fails closed when the node is unreachable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const { readSnapshot, buildReport } = await import('@/lib/protocol/read');
    const s = await readSnapshot();

    expect(s.node.ok).toBe(false);
    // deployments/aztec-mainnet.json: no escrow or stream, HLC recorded with its block.
    expect(s.record?.contracts).toEqual([]);
    expect(s.record?.tokens.map((t) => [t.symbol, t.decimals, t.deployBlock])).toEqual([['HLC', 6, 24544]]);
    expect(s.record?.sponsoredFpc).toBeNull();
    expect(s.token?.totalSupply).toMatchObject({ error: expect.any(String) });

    const report = buildReport(s, new Date('2026-11-13T12:00:00Z'));
    expect(report.anchorBlock).toBeNull();
    const { digest, digestAlgorithm, ...body } = report;
    expect(digestAlgorithm).toBe('sha256');
    expect(digest).toBe(createHash('sha256').update(canonicalJson(body)).digest('hex'));
    // No figure that depends on the node is shown.
    for (const id of ['hlc-supply', 'hlc-admin']) {
      expect(report.metrics.find((m) => m.id === id)?.value).toBeUndefined();
    }
    expect(report.metrics.find((m) => m.id === 'aztec-node')).toMatchObject({ status: 'unavailable', value: 'Node not responding' });
  });

  it('refuses a node that is not on Ethereum mainnet and does not read token storage from it', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const { method } = JSON.parse(String(init?.body));
      calls.push(method);
      const result =
        method === 'node_getBlockNumber'
          ? 100
          : method === 'node_getNodeInfo'
            ? { nodeVersion: '6.0.0', l1ChainId: 11155111, rollupVersion: 1, l1ContractAddresses: {} }
            : '0x01';
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200 });
    }) as unknown as typeof fetch;
    const { readSnapshot } = await import('@/lib/protocol/read');
    const s = await readSnapshot();
    expect(s.node.ok && s.node.drift.length > 0).toBe(true);
    expect(calls).not.toContain('node_getPublicStorageAt');
    expect(s.token?.totalSupply).toMatchObject({ error: 'the node differs from the pins' });
  });

  it('treats a JSON-RPC error as a failed read', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }), { status: 200 }),
    ) as unknown as typeof fetch;
    const { readSnapshot } = await import('@/lib/protocol/read');
    const s = await readSnapshot();
    expect(s.node).toMatchObject({ ok: false });
  });
});
