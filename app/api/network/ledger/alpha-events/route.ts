import { NextRequest, NextResponse } from 'next/server';
import { ledgerService } from '../../../../../lib/services/ledger-data';


export const dynamic = 'force-dynamic';

// Hard API timeout: 8 seconds maximum. Never blocks for 300s.
const API_TIMEOUT_MS = 8000;

/**
 * [LEGENDARY V6.0] Alpha Events API
 * Non-blocking Redis cache + Staggered Moralis scanner + Synthetic Alpha failsafe.
 * Guaranteed to respond in under 8 seconds regardless of infrastructure state.
 */
export async function GET(req: NextRequest) {
    try {
        const alerts = await Promise.race([
            ledgerService.getLatestLedgerActivity(
                50,
                undefined as any,
                15000 as any
            ),
            new Promise<never>((_idx, reject) =>
                setTimeout(() => reject(new Error('Alpha scanner timeout')), API_TIMEOUT_MS)
            )
        ]);

        // Format for the VIP store parser (includes new V6.0 telemetry)
        const formattedEvents = alerts.map(evt => ({
            id: evt.id,
            wallet: evt.from,
            label: evt.label || 'Elite Ledger',
            tier: evt.tier || 'ALPHA',
            action: evt.action === 'BUY' ? 'BUY' : (evt.action === 'SELL' ? 'SELL' : 'TRANSFER'),
            token: evt.token,
            amount: evt.amount,
            usdNum: evt.usdNum,
            usdValue: evt.usdNum >= 1_000_000
                ? `$${(evt.usdNum / 1_000_000).toFixed(2)}M`
                : `$${(evt.usdNum / 1_000).toFixed(0)}K`,
            dex: (evt as any).dex || 'Ethereum',
            winRate: (evt as any).winRate || 92,
            age: Math.floor((Date.now() - evt.ts) / 1000),
            hash: evt.hash,
            ts: evt.ts,
            type: evt.action === 'BUY' ? 'accumulation' : (evt.action === 'SELL' ? 'dump' : 'transfer'),
            confidence: evt.confidence || 95,
            //  V6.0 Deep Telemetry Fields
            gasUsed: (evt as any).gasUsed,
            confirmations: (evt as any).confirmations,
            telemetryTag: (evt as any).telemetryTag,
        }));

        return NextResponse.json({
            events: formattedEvents,
            status: 'synchronized',
            scanner: 'V6_LEGENDARY',
            count: formattedEvents.length,
            timestamp: Date.now(),
        });

    } catch (error: any) {
        console.error('[Alpha Events V6] Scanner error:', error?.message);
        // Return empty events instead of 500  UI shows "Waiting for anomalies..."
        return NextResponse.json({
            events: [],
            status: 'degraded',
            scanner: 'V6_LEGENDARY',
            error: error?.message ?? 'Scanner offline',
        });
    }
}

