import { NextRequest, NextResponse } from 'next/server';
import { AZTEC_NETWORKS } from '@/lib/aztec/sequencer/networks';
import { identifyNode } from '@/lib/aztec/fees';
import { relayUpstreams } from '@/lib/aztec/node-relay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/aztec/account?address=0x...
 *
 * Status of the pinned Aztec Alpha node, for an EVM address. It does NOT return an Aztec
 * address: a person's Aztec address is derived on their own device from a wallet signature
 * (lib/aztec/wallet/keys.ts, lib/aztec/wallet/client.ts) and the server never sees the keys.
 *
 * Until 13 Nov 2026 this route returned sha256(sha256("aztec-schnorr:" + address)) as the
 * "Aztec address", with `registered: true` and an explorer link to it. No account lives at that
 * address, so funds sent to it would be lost; it also reported rpcStatus "live" with hard-coded
 * block numbers when the node did not answer. Both are gone (finding F-08c).
 *
 * Fail closed: rpcStatus is "live" only when the node answered with a well-formed node info that
 * matches the client's pins; otherwise "unavailable" (or "mismatch") and mainnetData is null.
 */

interface NodeSnapshot {
  blockNumber: number;
  nodeVersion: string;
  l1ChainId: number;
  rollupVersion: number;
  rollupAddress: string | null;
  latencyMs: number;
}

const PINS = AZTEC_NETWORKS.mainnet;
const TIMEOUT_MS = 8_000;

async function rpc(url: string, method: string): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }),
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (body?.error) throw new Error(String(body.error.message ?? 'JSON-RPC error'));
  if (body?.result === undefined) throw new Error('no result');
  return body.result;
}

const safeInt = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? v : null;
  if (typeof v === 'string' && /^(0x[0-9a-fA-F]+|\d+)$/.test(v)) {
    const n = BigInt(v);
    return n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : null;
  }
  return null;
};

export async function GET(req: NextRequest) {
  const evmAddress = req.nextUrl.searchParams.get('address');
  if (!evmAddress || !/^0x[0-9a-fA-F]{40}$/.test(evmAddress)) {
    return NextResponse.json({ error: 'Missing or invalid EVM address.' }, { status: 400 });
  }

  const [nodeUrl] = relayUpstreams({ ...process.env, NEXT_PUBLIC_AZTEC_NETWORK: 'alpha' });
  const url = nodeUrl || PINS.publicNodeRpc;

  let rpcStatus: 'live' | 'mismatch' | 'unavailable' = 'unavailable';
  let mainnetData: NodeSnapshot | null = null;
  let drift: string[] = [];

  try {
    const start = Date.now();
    const [blockRaw, infoRaw] = await Promise.all([rpc(url, 'node_getBlockNumber'), rpc(url, 'node_getNodeInfo')]);
    const info = (infoRaw ?? {}) as {
      nodeVersion?: unknown;
      l1ChainId?: unknown;
      rollupVersion?: unknown;
      l1ContractAddresses?: { rollupAddress?: unknown };
    };
    const blockNumber = safeInt(blockRaw);
    const l1ChainId = safeInt(info.l1ChainId);
    const rollupVersion = safeInt(info.rollupVersion);
    if (blockNumber !== null && l1ChainId !== null && rollupVersion !== null && typeof info.nodeVersion === 'string') {
      const rollupAddress = typeof info.l1ContractAddresses?.rollupAddress === 'string' ? info.l1ContractAddresses.rollupAddress : null;
      const identity = identifyNode({
        l1ChainId,
        rollupVersion,
        nodeVersion: info.nodeVersion,
        l1ContractAddresses: rollupAddress ? { rollupAddress } : undefined,
      });
      drift =
        identity.network !== 'mainnet'
          ? [`L1 chain ${l1ChainId} is not Ethereum mainnet`]
          : identity.drift.map((d) => `${d.field} ${d.actual} (expected ${d.expected})`);
      mainnetData = { blockNumber, nodeVersion: info.nodeVersion, l1ChainId, rollupVersion, rollupAddress, latencyMs: Date.now() - start };
      rpcStatus = drift.length ? 'mismatch' : 'live';
    }
  } catch (e: unknown) {
    console.warn('[Aztec Account] node probe failed:', e instanceof Error ? e.message : e);
  }

  let nodeHost: string | null = null;
  try {
    nodeHost = new URL(url).host;
  } catch {
    nodeHost = null;
  }

  return NextResponse.json(
    {
      evmAddress: evmAddress.toLowerCase(),
      aztecAddress: null,
      aztecAddressNote: 'Derived on your own device from a wallet signature when you open the private wallet; never computed by the server.',
      network: PINS.label,
      nodeHost,
      rpcStatus,
      drift,
      mainnetData,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
