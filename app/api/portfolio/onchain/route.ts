/**
 * GET /api/portfolio/onchain
 * 
 * Returns real ETH + ERC-20 balances for a given wallet using GetBlock EP1.
 * Uses: https://go.getblock.io/441dd184fb9740e9af094500d43bd0f8
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserPortfolio } from '@/lib/blockchain/getblock-engine';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid or missing wallet address.' },
      { status: 400 }
    );
  }

  try {
    const portfolio = await getUserPortfolio(address);

    return NextResponse.json({
      ok: true,
      address,
      ethBalance: portfolio.ethBalance,
      tokens: portfolio.tokens,
      fetchedAt: new Date().toISOString(),
      source: 'getblock-ep1',
    });
  } catch (err: any) {
    console.error('[OnChain Portfolio] Error:', err.message);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch on-chain portfolio data.', detail: 'Internal error' },
      { status: 502 }
    );
  }
}
