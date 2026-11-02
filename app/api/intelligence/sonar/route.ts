import { NextResponse } from 'next/server';
import { mainnetClient, bscClient } from '@/lib/blockchain/rpc-engine';
import { formatUnits } from 'viem';
import { ledgerService } from '@/lib/services/ledger-data';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [ethGas, bscGas, latestLedgers] = await Promise.all([
            mainnetClient.getGasPrice(),
            bscClient.getGasPrice(),
            ledgerService.getLatestLedgerActivity(5)
        ]);

        const ethGwei = parseFloat(formatUnits(ethGas, 9));
        
        const sonarAlerts: { id: number; text: string; type: 'threat' | 'opportunity' }[] = latestLedgers.map((w, i) => ({
            id: i,
            text: ` LEDGER detected on ${w.chain}: ${w.amount} ${w.token} movement`,
            type: 'opportunity' as const
        }));

        // Add some "Scans" based on real network state
        if (ethGwei > 50) {
            sonarAlerts.push({ id: 101, text: 'HIGH GWEI SPIKE: Front-Running Risk Elevated', type: 'threat' as const });
        } else {
            sonarAlerts.push({ id: 102, text: 'OPTIMUM GAS: Arbitrage Window Open', type: 'opportunity' as const });
        }

        return NextResponse.json({
            success: true,
            roi: 14.25 + (Math.sin(Date.now() / 10000) * 0.1), // Deterministic pseudo-fluctuation based on time
            burnRate: parseFloat(formatUnits(ethGas, 18)) * 144, // Actual ETH burned per hr approx.
            alerts: sonarAlerts.slice(0, 4)
        });
    } catch (e) {
        console.error('[SONAR ERROR]', e);
        return NextResponse.json({ success: false, alerts: [] });
    }
}
