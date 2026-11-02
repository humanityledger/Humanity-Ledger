// @ts-nocheck
/**
 * /api/dev/deploy — Aztec QDs Token Deployment Status
 *
 * REVISED APPROACH: The Aztec SDK v5.0.0 EmbeddedWallet always boots a local PXE server
 * (port 18080) via native C++ binaries from @aztec/pxe/server — this is not compatible
 * with being called from a Next.js API route.
 *
 * THE CORRECT DEPLOYMENT PATH:
 * Run the deploy script as a Railway one-off command using the Railway CLI or
 * the "Railway Run" feature in the dashboard with:
 *   npx tsx scripts/deploy_aztec_token.ts
 *
 * This endpoint now returns a clear status with the actionRequired instructions.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // B-005: Disabled in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const nodeUrl = process.env.AZTEC_NODE_URL || 'https://node.aztec.network';
  const relayerSecretHex = process.env.AZTEC_RELAYER_SECRET_KEY;
  const existingAddress = process.env.AZTEC_TOKEN_CONTRACT_ADDRESS;

  // Already deployed — return the address
  if (existingAddress && existingAddress !== 'PENDING_DEPLOY') {
    return NextResponse.json({
      success: true,
      status: 'DEPLOYED',
      tokenAddress: existingAddress,
      message: '✅ QDs Token is already deployed.',
    });
  }

  // Check connectivity to Aztec node
  let nodeInfo: any = null;
  try {
    const { createAztecNodeClient } = await import('@aztec/aztec.js/node');
    const node = createAztecNodeClient(nodeUrl);
    const [blockNumber, info] = await Promise.all([
      node.getBlockNumber(),
      node.getNodeInfo(),
    ]);
    nodeInfo = {
      blockNumber,
      chainId: info.l1ChainId,
      version: info.nodeVersion,
    };
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      status: 'NODE_UNREACHABLE',
      error: `Aztec testnet node unreachable: ${e.message}`,
      nodeUrl,
    }, { status: 503 });
  }

  // Node is reachable — return deployment instructions
  return NextResponse.json({
    success: false,
    status: 'PENDING_DEPLOY',
    message: 'QDs Token not yet deployed. The Aztec SDK requires running the deploy script as a one-off process.',
    nodeInfo,
    relayerConfigured: !!relayerSecretHex,
    deploymentInstructions: {
      method: 'Railway One-Off Command',
      steps: [
        '1. Open Railway Dashboard → your project → ledger-wallet service',
        '2. Click the "..." menu → "Run Command"',
        '3. Enter: npx tsx scripts/deploy_aztec_token.ts',
        '4. Copy the AZTEC_TOKEN_CONTRACT_ADDRESS from the output',
        '5. Add it to Railway Environment Variables and redeploy',
      ],
      alternativeMethod: 'Local Linux / WSL',
      alternativeSteps: [
        'On a Linux machine: git clone the repo',
        'Copy .env with AZTEC_RELAYER_SECRET_KEY set',
        'Run: npm install && npx tsx scripts/deploy_aztec_token.ts',
      ],
    },
    technicalNote: 'EmbeddedWallet.create() in @aztec/wallets v5.0.0 boots a local PXE process on port 18080 via @aztec/pxe/server native binaries. This cannot run inside a Next.js API route handler.',
  }, { status: 202 });
}
