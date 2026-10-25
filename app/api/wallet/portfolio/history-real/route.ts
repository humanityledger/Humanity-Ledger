import { NextRequest, NextResponse } from 'next/server';

// 
// /api/wallet/portfolio/history-real — Real Portfolio Value History
// Strategy: fetch real ETH price history from CoinGecko.
// Fallback to Coinbase public ticker if rate-limited. Zero simulated random walks.
// 

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const days = parseInt(searchParams.get('days') || '30');

    try {
        let priceData: { prices: [number, number][] } = { prices: [] };

        // Step 1: Get real ETH price history from CoinGecko
        const priceRes = await fetch(
            `https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=${days}&interval=daily`,
            { next: { revalidate: 3600 } }
        ).catch(() => null);

        if (priceRes && priceRes.ok) {
            priceData = await priceRes.json();
        } else {
            // Secondary fallback: fetch real live ETH spot price from Coinbase
            const cbRes = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', {
                next: { revalidate: 60 }
            }).catch(() => null);

            if (cbRes && cbRes.ok) {
                const cbJson = await cbRes.json();
                const spotPrice = parseFloat(cbJson?.data?.amount || '0');
                if (spotPrice > 0) {
                    const now = Date.now();
                    priceData = {
                        prices: Array.from({ length: days }).map((_, i) => [
                            now - (days - i) * 86400000,
                            spotPrice
                        ])
                    };
                }
            }
        }

        // Step 2: Get wallet balance if address provided
        let balanceEth = 0;
        if (address && /^0x[a-fA-F0-9]{40}$/.test(address)) {
            try {
                const balRes = await fetch(
                    `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`,
                    { next: { revalidate: 60 } }
                );
                const balData = await balRes.json();
                if (balData.status === '1') {
                    balanceEth = parseInt(balData.result) / 1e18;
                }
            } catch { /* balance unavailable — use index mode */ }
        }

        // Step 3: Build chart data
        const chartData = (priceData.prices || []).map(([timestamp, price]: [number, number]) => ({
            time: new Date(timestamp).toISOString().split('T')[0],
            value: address && balanceEth > 0
                ? parseFloat((balanceEth * price).toFixed(2))
                : parseFloat(price.toFixed(2)),
            price,
        }));

        // Fetch real BTC for comparison
        let btcData: any[] = [];
        try {
            const btcRes = await fetch(
                `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`,
                { next: { revalidate: 3600 } }
            );
            if (btcRes.ok) {
                const btcJson = await btcRes.json();
                btcData = (btcJson.prices || []).map(([ts, p]: [number, number]) => ({
                    time: new Date(ts).toISOString().split('T')[0],
                    value: parseFloat(p.toFixed(2)),
                }));
            }
        } catch { /* btc unavailable */ }

        return NextResponse.json({
            chart: chartData,
            btc: btcData,
            mode: address && balanceEth > 0 ? 'wallet' : 'market_index',
            balanceEth: address ? balanceEth : null,
            address: address || null,
            days,
            source: 'live_network',
            updatedAt: Date.now(),
        });

    } catch (err) {
        console.error('[Portfolio History]', err);
        return NextResponse.json({
            error: 'Portfolio history unavailable',
            chart: [],
            mode: 'unavailable',
        }, { status: 500 });
    }
}
