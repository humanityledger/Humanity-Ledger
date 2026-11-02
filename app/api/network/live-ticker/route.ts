
import { NextResponse } from 'next/server';
import { mainnetClient, bscClient } from '@/lib/blockchain/rpc-engine';
import { formatUnits } from 'viem';
import { ledgerService } from '@/lib/services/ledger-data';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const results = await Promise.allSettled([
            mainnetClient.getBlockNumber(),
            bscClient.getBlockNumber(),
            mainnetClient.getGasPrice(),
            bscClient.getGasPrice(),
            ledgerService.getLatestLedgerActivity(5)
        ]);

        const ethBlock = results[0].status === 'fulfilled' ? results[0].value : null;
        const bscBlock = results[1].status === 'fulfilled' ? results[1].value : null;
        const ethGas = results[2].status === 'fulfilled' ? results[2].value : null;
        const bscGas = results[3].status === 'fulfilled' ? results[3].value : null;
        const ledgerMovements = results[4].status === 'fulfilled' ? results[4].value : [];

        const tickerItems = [];
        if (ethBlock) tickerItems.push(`ETH BLOCK: ${ethBlock}`);
        if (bscBlock) tickerItems.push(`BSC BLOCK: ${bscBlock}`);
        if (ethGas) tickerItems.push(`ETH GAS: ${Math.floor(Number(formatUnits(ethGas, 9)))} GWEI`);
        if (bscGas) tickerItems.push(`BSC GAS: ${Number(formatUnits(bscGas, 9)).toFixed(2)} GWEI`);

        // Add latest ledger movements to the ticker
        if (Array.isArray(ledgerMovements)) {
            ledgerMovements.forEach(m => {
                tickerItems.push(` LEDGER: ${m.amount} ${m.token} ON ${m.chain} detected`);
            });
        }

        // Add Price Data (Mocked but real-ish using Binance Ticker)
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            const btc = data.find((d: any) => d.symbol === 'BTCUSDT');
            const eth = data.find((d: any) => d.symbol === 'ETHUSDT');
            const bnb = data.find((d: any) => d.symbol === 'BNBUSDT');

            if (btc) tickerItems.push(`BTC: $${parseFloat(btc.lastPrice).toLocaleString()} ${btc.priceChangePercent}%`);
            if (eth) tickerItems.push(`ETH: $${parseFloat(eth.lastPrice).toLocaleString()} ${eth.priceChangePercent}%`);
            if (bnb) tickerItems.push(`BNB: $${parseFloat(bnb.lastPrice).toLocaleString()} ${bnb.priceChangePercent}%`);
        }

        return NextResponse.json({ 
            success: true, 
            ticker: tickerItems,
            stats: {
                ethBlock: Number(ethBlock),
                bscBlock: Number(bscBlock),
                ledgerCount: ledgerMovements.length,
                // FIX Bug 12: Removed hardcoded fake uptime and volume metrics.
                // These are KPIs that must come from real monitoring, not constants.
                uptime: null,
                volume24h: null,
            }
        });
    } catch (e) {
        // FIX Bug 12: Removed all Math.random() fake block numbers and fake prices.
        // Returning a clearly-marked degraded state instead of fabricated data.
        // The UI can detect success:false and render a degraded-mode banner.
        console.error('[TICKER ERROR] RPC or data source failed:', e);
        return NextResponse.json({ 
            success: false,
            degraded: true,
            ticker: [
                'NETWORK STATUS: DEGRADED  RECONNECTING...',
                'DATA FEEDS TEMPORARILY UNAVAILABLE',
            ],
            stats: {
                ethBlock: null,
                bscBlock: null,
                ledgerCount: 0,
                uptime: null,
                volume24h: null,
            }
        });
    }
}

