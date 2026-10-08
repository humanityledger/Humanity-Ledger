import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dev/testpxe
 * Tests raw JSON-RPC connectivity to the Aztec PXE/Node using native fetch.
 * No SDK imports - just raw HTTP to verify the sidecar is alive.
 */
export async function GET() {
  const pxeUrl = process.env.AZTEC_PXE_URL || 'https://node.aztec.network';
  const nodeUrl = process.env.AZTEC_NODE_URL || 'https://node.aztec.network';
  
  try {
    // Test PXE connectivity with raw JSON-RPC
    const pxeRes = await fetch(pxeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'pxe_getNodeInfo', params: [] }),
      signal: AbortSignal.timeout(8000),
    });
    
    const pxeData = await pxeRes.json();
    const pxeInfo = pxeData.result || pxeData.error;

    // Test Node connectivity with raw JSON-RPC
    let nodeInfo: any = null;
    let nodeBlock: any = null;
    try {
      const [nodeInfoRes, nodeBlockRes] = await Promise.all([
        fetch(nodeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'node_getNodeInfo', params: [] }), signal: AbortSignal.timeout(8000) }),
        fetch(nodeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'node_getBlockNumber', params: [] }), signal: AbortSignal.timeout(8000) }),
      ]);
      nodeInfo = (await nodeInfoRes.json()).result;
      nodeBlock = (await nodeBlockRes.json()).result;
    } catch (e: any) {
      nodeInfo = { error: 'Internal Server Error' };
    }

    return NextResponse.json({
      success: true,
      pxe: { url: pxeUrl, info: pxeInfo },
      node: { url: nodeUrl, info: nodeInfo, blockNumber: nodeBlock },
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'Internal Server Error', 
      pxeUrl,
      hint: 'Ensure AZTEC_PXE_URL points to a running PXE sidecar.',
    }, { status: 500 });
  }
}
