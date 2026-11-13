/**
 * GET /api/user/portfolio?address=0x...
 * Powers ActivePortfolio panel via GetBlock EP1 (JSON-RPC)
 * Real on-chain ETH + ERC-20 balances  no synthetic data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserPortfolio } from '@/lib/blockchain/getblock-engine';

import { PriceService } from '@/lib/blockchain/PriceService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { getSession } = await import('@/lib/session');
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
        }
        const address = session.userId;

        const { ethBalance, tokens } = await getUserPortfolio(address);

        // Fetch Real-Time Oracle prices for ALL assets (EP1 On-Chain + PriceService)
        const assetQueries = [
            { symbol: 'ETH' },
            ...tokens.map(t => ({ symbol: t.symbol, address: (t as any).contractAddress }))
        ];
        const realPrices = await PriceService.getBulkPrices(assetQueries);

        // USD values only where a price was read. No invented price (this used to assume
        // $2,300 for ETH and $0 for any other token): unpriced positions have usdValue null.
        type Position = {
            symbol: string; name: string; balance: number;
            usdPrice: number | null; usdValue: number | null; change24h: number | null;
            portfolioPct: number | null; chain: string;
        };
        const position = (symbol: string, name: string, balance: number): Position => {
            const q = realPrices[symbol.toUpperCase()];
            return {
                symbol, name, balance,
                usdPrice: q ? q.price : null,
                usdValue: q ? balance * q.price : null,
                change24h: q ? q.change24h : null,
                portfolioPct: null,
                chain: 'ethereum',
            };
        };
        const ethPosition = position('ETH', 'Ethereum', ethBalance);
        const tokenList = tokens.map(t => position(t.symbol, t.symbol, t.balance));

        const all = [ethPosition, ...tokenList].filter(t => t.symbol === 'ETH' || t.balance > 0);
        const priced = all.filter(t => t.usdValue !== null);
        const totalUsd = priced.reduce((s, t) => s + (t.usdValue as number), 0);
        priced.forEach(t => { t.portfolioPct = totalUsd > 0 ? ((t.usdValue as number) / totalUsd) * 100 : null; });

        return NextResponse.json({
            address,
            totalUsd,
            totalIsPartial: priced.length < all.length,
            unpriced: all.filter(t => t.usdValue === null).map(t => t.symbol),
            tokens: all,
            source: 'getblock_ep1_onchain',
            fetchedAt: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('[Portfolio EP1 Error]', error?.message);
        // Fail closed: an outage is an error, never an empty portfolio worth $0.
        return NextResponse.json({ error: 'Portfolio could not be read.' }, { status: 503 });
    }
}
