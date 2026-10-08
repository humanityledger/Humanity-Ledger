import { NextRequest, NextResponse } from 'next/server';
import { walletAnalyticsService } from '@/lib/wallet/WalletAnalyticsService';

/**
 * GET /api/premium/wallet-analytics?address=[address]
 * Serves the detailed analytics required by the WalletAnalyticsPanel.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  try {
    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    console.log(`[API-ANALYTICS] Processing request for ${address}`);
    
    // Fetch full analytics report (cached or fresh)
    const intel = await walletAnalyticsService.getFullAnalytics(address);

    // Map to the specific structure expected by WalletAnalyticsPanel
    const analytics: any = {
        error: (intel as any).error,
        errorMessage: (intel as any).errorMessage,
        isPartial: !!(intel as any).error,
        totalTransactions: intel.txCount,
        activityScore: intel.activityScore,
        riskScore: intel.riskScore,
        blockchainRank: intel.rank,
        pnl24h: intel.pnl24h,
        change24h: intel.change24h,
        ledgerEvidence: intel.ledgerEvidence || [],
        influenceScore: intel.influenceScore || 0,
        identityTier: intel.identityTier || 'GHOST',
        transactionHeatmap: intel.transactionHeatmap || generateHeatmapFromActivity(intel),
        topCounterparties: intel.topCounterparties || [
            ...intel.flowAnalysis.topSenders.map((s: any) => ({ address: s.address, txCount: s.count, totalVolume: s.amount })),
            ...intel.flowAnalysis.topReceivers.map((r: any) => ({ address: r.address, txCount: r.count, totalVolume: r.amount }))
        ].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 10),
        
        tokenFlowAnalysis: intel.tokenFlowAnalysis || [
            {
                token: 'USD Aggregate',
                inflow: intel.flowAnalysis.inflow,
                outflow: intel.flowAnalysis.outflow,
                netFlow: intel.flowAnalysis.inflow - intel.flowAnalysis.outflow
            }
        ],

        historicalBalance: (intel as any).historicalBalance || [],
        smartContractInteractions: intel.dappActivities.map((d: any) => ({
            contract: d.protocol,
            protocol: d.protocol,
            firstSeen: new Date(d.latestActivity), 
            lastSeen: new Date(d.latestActivity),
            txCount: d.count
        })),
        nftPortfolio: intel.nftPortfolio.map((n: any) => ({
            contract: n.contract,
            tokenId: n.tokenId,
            name: n.name,
            imageUrl: n.image,
            floorPrice: n.floorPrice
        })),
        
        stakingPositions: intel.yieldPositions.filter((p: any) => p.type === 'staking' || p.type === 'lending').map((p: any) => ({
            protocol: p.protocol,
            token: p.asset,
            amount: p.amount,
            valueUsd: p.valueUsd || p.amount, 
            apr: p.apy,
            onChain: (p as any).onChain,
            details: (p as any).details
        })),
        liquidityPools: intel.yieldPositions.filter((p: any) => p.type === 'farming' || p.type === 'LP').map((p: any) => ({
            protocol: p.protocol,
            pair: p.asset,
            liquidity: p.amount,
            valueUsd: p.valueUsd || p.amount,
            onChain: (p as any).onChain,
            details: (p as any).details
        })),
        
        profitLossBreakdown: [
            { token: 'Portfolio Delta', realized: 0, unrealized: intel.pnl24h, total: intel.pnl24h }
        ],
        
        ledgerMovements: intel.flowAnalysis.recentTransfers.map((t: any) => ({
            timestamp: new Date(t.timestamp),
            type: t.type,
            token: t.token || 'TOKEN', 
            amount: t.amount,
            valueUsd: t.valueUsd,
            txHash: t.hash,
            chainId: parseInt(t.chain) || 1
        })),
        
        networksActive: intel.networksActive || ['Ethereum'],
        lastUpdated: new Date(intel.lastUpdated)
    };

    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error(`[API-ANALYTICS-ERROR] ${address}:`, {
        message: error.message,
        stack: error.stack
    });
    
    return NextResponse.json({ 
      error: 'Failed to generate comprehensive wallet analytics',
      details: 'Error details redacted',
      isPartial: true,
      address,
      lastUpdated: new Date()
    }, { status: 200 }); // Returning 200 with partial flag to prevent UI crash
  }
}

function generateHeatmapFromActivity(intel: any) {
    const heatmap = Array.from({ length: 24 }, (_idx, i) => ({
        hour: i,
        txCount: 0,
        volume: 0
    }));

    const transfers = intel.flowAnalysis.recentTransfers || [];
    transfers.forEach((t: any) => {
        const date = new Date(t.timestamp);
        const hour = date.getHours();
        if (hour >= 0 && hour < 24) {
            heatmap[hour].txCount++;
            heatmap[hour].volume += t.valueUsd || 0;
        }
    });

    return heatmap;
}

