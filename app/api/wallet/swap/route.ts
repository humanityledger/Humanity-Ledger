import { NextRequest, NextResponse } from 'next/server';
import { swapService } from '@/lib/blockchain/SwapService';
import { ChainId } from '@/lib/blockchain/BlockchainService';

/**
 * GET /api/wallet/swap/quote
 * GET /api/wallet/swap/transaction
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action'); // 'quote' or 'tx'
    const chainId = parseInt(searchParams.get('chainId') || '1');
    const fromToken = searchParams.get('fromToken');
    const toToken = searchParams.get('toToken');
    const amount = searchParams.get('amount');
    const fromAddress = searchParams.get('address');

    if (!fromToken || !toToken || !amount) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (action === 'tx') {
      if (!fromAddress) return NextResponse.json({ error: 'Address required for tx' }, { status: 400 });
      const tx = await swapService.getSwapTransaction(
        chainId as ChainId,
        fromToken,
        toToken,
        amount,
        fromAddress
      );
      return NextResponse.json(tx);
    }

    if (action === 'bridge') {
        const toChainId = parseInt(searchParams.get('toChainId') || chainId.toString());
        if (!fromAddress) return NextResponse.json({ error: 'Address required for bridge' }, { status: 400 });
        
        const { bridgeService } = await import('@/lib/blockchain/BridgeService');
        const bridgeTx = await bridgeService.getBridgeTransaction(
            chainId,
            toChainId,
            fromToken,
            toToken,
            amount,
            fromAddress
        );
        return NextResponse.json(bridgeTx);
    }

    const quote = await swapService.getQuote(chainId as ChainId, fromToken, toToken, amount);
    return NextResponse.json(quote);
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

