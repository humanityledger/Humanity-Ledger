import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/aztec/deploy
 *
 * This endpoint provides instructions for deploying the Aztec Token contract.
 * The actual deployment must be performed from Railway CLI (Linux environment)
 * because @aztec/native uses platform-specific C++ binaries incompatible with Windows.
 *
 * Deployment command (run in Railway shell):
 *   npx tsx scripts/deploy_aztec_token.ts
 *
 * After deployment, set the environment variable:
 *   AZTEC_TOKEN_CONTRACT_ADDRESS=<deployed_address>
 *
 * This will activate Mode A (on-chain) in /api/aztec/transfer and /api/aztec/airdrop.
 */
export async function GET() {
  const tokenContractAddress = process.env.AZTEC_TOKEN_CONTRACT_ADDRESS;
  const pxeUrl = process.env.AZTEC_PXE_URL || 'https://node.aztec.network';
  const nodeUrl = process.env.AZTEC_NODE_URL || 'https://node.aztec.network';

  // Check if we can reach the Aztec mainnet node
  let nodeStatus: 'reachable' | 'unreachable' = 'unreachable';
  let nodeInfo: any = null;

  try {
    const res = await fetch(`${nodeUrl}/node-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'node_getNodeInfo', params: [], id: 1 }),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      nodeInfo = data?.result ?? null;
      nodeStatus = 'reachable';
    }
  } catch {
    nodeStatus = 'unreachable';
  }

  return NextResponse.json({
    status: 'deployment_required',
    mode: tokenContractAddress && tokenContractAddress !== 'PENDING_DEPLOY'
      ? 'A_ONCHAIN'
      : 'B_DB_ONLY',
    tokenContract: tokenContractAddress || 'NOT_DEPLOYED',
    pxeUrl,
    nodeUrl,
    nodeStatus,
    nodeInfo,
    instructions: {
      step1: 'Open your Railway project shell (Linux environment required)',
      step2: 'Run: npx tsx scripts/deploy_aztec_token.ts',
      step3: 'Copy the deployed contract address from the output',
      step4: 'Set Railway env var: AZTEC_TOKEN_CONTRACT_ADDRESS=<address>',
      step5: 'Redeploy — Mode A (on-chain transfers) will activate automatically',
    },
    network: 'aztec-mainnet-v5',
    explorer: 'https://aztecscan.xyz',
  });
}
