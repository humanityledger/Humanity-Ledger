import { NextRequest, NextResponse } from 'next/server';
import { portfolioService } from '@/lib/blockchain/PortfolioService';
import { ChainId } from '@/lib/blockchain/BlockchainService';
import { PriceService } from '@/lib/blockchain/PriceService';

export async function GET(req: NextRequest) {
  try {
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    const address = session.userId.toLowerCase();
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get('timeframe') || '7d';

    console.log(`[MASTER-HISTORY-SYNC] Tracing cross-chain assets for ${address} (${timeframe})...`);

    // 1. Fetch history from multiple primary chains
    const chains = [ChainId.MAINNET, ChainId.BASE, ChainId.POLYGON, ChainId.ARBITRUM, ChainId.OPTIMISM, ChainId.AVALANCHE, ChainId.BSC, ChainId.WORLDCHAIN];
    
    // We fetch current portfolio to get the end-state total value
    const portfolio = await portfolioService.getMultiChainPortfolio(address);
    const currentTotalUsd = portfolio?.totalValueUsd || 0;

    const histories = await Promise.all(
        chains.map(id => portfolioService.getAssetHistory(id, address).catch(e => []))
    );
    
    const allTransfers = histories.flat().sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
    });

    // 2. Aggregate History across time buckets
    const points = timeframe === '24h' ? 24 : timeframe === '7d' ? 14 : timeframe === '30d' ? 30 : 60;
    const now = Math.floor(Date.now() / 1000);
    const secondsPerPoint = timeframe === '24h' ? 3600 : timeframe === '7d' ? 43200 : 86400;
    
    //  [LEGENDARY] PRICE DISCOVERY FOR HISTORY
    const uniqueAssets = Array.from(new Set(allTransfers.map(tx => tx.asset).filter(Boolean)));
    const assetPrices = await PriceService.getBulkPrices(uniqueAssets.map(sym => ({ symbol: sym })));

    const resultHistory: any[] = [];

    for (let i = 0; i < points; i++) {
        const bucketTime = now - (i * secondsPerPoint);
        const bucketDate = new Date(bucketTime * 1000);

        // Find transfers that occurred AFTER this bucket point (to subtract from current)
        const netChangeUsd = allTransfers
            .filter(tx => new Date(tx.timestamp).getTime() > bucketDate.getTime())
            .reduce((acc, tx) => {
                const valRaw = parseFloat(String(tx.value || '0'));
                const assetSym = (tx.asset || 'ETH').toUpperCase();
                const price = assetPrices[assetSym]?.price;
                if (typeof price !== 'number') return acc; // no invented price: unpriced transfers are left out
                const valUsd = valRaw * price;
                
                if (tx.direction === 'OUT') return acc - valUsd; // Sent
                if (tx.direction === 'IN') return acc + valUsd; // Received
                return acc;
            }, 0);

        // Heuristic P&L: Assume average price of $1 for simplified historical units 
        // OR better: use current value and subtract net delta.
        // This is "Direct Ledger Truth" reconstruction.
        const historicalBalance = Math.max(0, currentTotalUsd - netChangeUsd);

        resultHistory.unshift({
            timestamp: bucketTime,
            date: timeframe === '24h' 
                ? bucketDate.toLocaleTimeString([], { hour: '2-digit' })
                : bucketDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            value: historicalBalance,
            pnl: (historicalBalance - (resultHistory[0]?.value || historicalBalance)) || 0, // Real incremental P&L
            activity: allTransfers.filter(tx => {
                const txTime = new Date(tx.timestamp).getTime();
                return txTime <= bucketDate.getTime() && txTime > (bucketDate.getTime() - secondsPerPoint * 1000);
            }).length
        });
    }

    return NextResponse.json({ 
        history: resultHistory,
        summary: {
            totalPoints: resultHistory.length,
            netChange: currentTotalUsd - resultHistory[0].value,
            address
        }
    });

  } catch (e: any) {
    console.error('[MASTER-HISTORY-ERROR]', e);
    return NextResponse.json({ error: 'History reconstruction failed', details: e.message }, { status: 500 });
  }
}

