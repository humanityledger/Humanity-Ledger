import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/test-aztec
 * Tests live connectivity to the Aztec Mainnet v5 RPC node.
 * Uses raw JSON-RPC (no SDK import issues) so it always works server-side.
 */
export async function GET() {
  const rpcUrl = process.env.AZTEC_NODE_URL || 'https://node.aztec.network';

  try {
    // Raw JSON-RPC call — works in any Node.js environment without ESM issues
    const rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'aztec_getNodeInfo',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!rpcRes.ok) {
      throw new Error(`RPC HTTP error: ${rpcRes.status}`);
    }

    const json = await rpcRes.json() as any;

    if (json.error) {
      throw new Error(`RPC error: ${json.error.message}`);
    }

    const nodeInfo = json.result;

    // Also check SponsoredFPC address is configured
    const fpcAddress = process.env.SPONSORED_FPC_ADDRESS || 'NOT_CONFIGURED';

    return NextResponse.json({
      success:         true,
      rpcUrl,
      chainId:         nodeInfo?.chainId        ?? nodeInfo?.chain_id,
      rollupAddress:   nodeInfo?.rollupAddress   ?? nodeInfo?.l1ContractAddresses?.rollupAddress,
      nodeVersion:     nodeInfo?.nodeVersion     ?? nodeInfo?.aztecProtocolVersion,
      sponsoredFpc:    fpcAddress,
      timestamp:       new Date().toISOString(),
      note:            'Connected to Aztec Mainnet v5 — Zero-Mock mode ACTIVE',
    });

  } catch (err: any) {
    return NextResponse.json({
      success:   false,
      rpcUrl,
      error:     err.message,
      hint:      'PXE may need to be running locally (aztec start --pxe) or AZTEC_NODE_URL misconfigured',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

