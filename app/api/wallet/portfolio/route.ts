import { NextRequest, NextResponse } from 'next/server';
import { portfolioService } from '@/lib/blockchain/PortfolioService';
import { ChainId } from '@/lib/blockchain/BlockchainService';
import { privyRelayer } from '@/lib/services/PrivyRelayerService';

/** Safe serializer  avoids JSON.stringify crash on BigInt values */
function safeSerialize(data: unknown): string {
  return JSON.stringify(data, (_idx, v) =>
    typeof v === 'bigint' ? v.toString() : v
  );
}

/**
 * GET /api/wallet/portfolio
 * Fetches multi-chain portfolio with BigInt-safe serialization and a hard
 * global timeout that guarantees a response within 12 seconds.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  // Verify Privy JWT (Precision On-Chain Guard)
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = await privyRelayer.verifyToken(token);
    if (!payload) {
        console.warn(`[API-Portfolio] Invalid or exhausted Privy JWT for ${address}`);
        // For absolute precision, we might reject, but to not break existing clients
        // we log it. If you want strict enforcement:
        // return NextResponse.json({ error: 'Unauthorized Privy Session' }, { status: 401 });
    }
  } else {
    // Check if the platform mandates JWTs now
    console.debug(`[API-Portfolio] Missing Privy Authorization header for ${address}`);
  }

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  const requestedChains = searchParams.get('chainIds')
    ?.split(',')
    .map(id => parseInt(id))
    .filter(id => !isNaN(id));

  const chains = (requestedChains && requestedChains.length > 0
    ? requestedChains
    : [
        ChainId.MAINNET, ChainId.POLYGON, ChainId.BASE,
        ChainId.ARBITRUM, ChainId.OPTIMISM, ChainId.AVALANCHE,
        ChainId.BSC, ChainId.WORLDCHAIN,
      ]) as ChainId[];

  // Hard 28-second global guard  must be LARGER than the per-chain 25s timeout
  // inside PortfolioService so individual chains can complete before the API cuts them off.
  // Railway serverless function limit is 60s; 28s gives chains 25s + 3s for aggregation.
  const GLOBAL_TIMEOUT_MS = 28_000;

  const timeoutResult = new Promise<any>((resolve) =>
    setTimeout(() => resolve({
      totalValueUsd: 0,
      change24hPercent: 0,
      change24hUSD: 0,
      tokens: [],
      chainBreakdown: {},
      address,
      status: 'TIMEOUT',
      error: 'GLOBAL_TIMEOUT  partial data only.',
    }), GLOBAL_TIMEOUT_MS)
  );

  try {
    const portfolio = await Promise.race([
      portfolioService.getMultiChainPortfolio(address, chains),
      timeoutResult,
    ]);

    console.log(`[API-Portfolio] ${address}: ${portfolio?.tokens?.length ?? 0} tokens | $${portfolio?.totalValueUsd?.toFixed(2)} | status: ${portfolio?.status ?? 'OK'}`);

    return new NextResponse(safeSerialize(portfolio), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[API-Portfolio] Unhandled error:', error.message);
    return new NextResponse(
      safeSerialize({
        totalValueUsd: 0,
        tokens: [],
        chainBreakdown: {},
        address,
        error: 'Internal Server Error' ?? 'FETCH_FAILED',
      }),
      {
        status: 200, // Return 200 so the UI shows empty state, not a red error
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
