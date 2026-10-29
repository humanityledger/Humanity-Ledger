import { NextResponse } from 'next/server';
import { getEndpointSummary, getActiveCount, getCoveredChains } from '@/lib/blockchain/getblock-registry';
import { RpcRelayerManager } from '@/lib/blockchain/rpc-relayer';
import { GlobalRPCRouter } from '@/lib/rpc-router';
import { isCronAuthorized } from '@/lib/security/cronAuth';

/**
 * GET /api/network/getblock-health
 *
 * Dashboard de salud del pool GetBlock.
 * Protegido por CRON_SECRET para evitar exposición pública de IPs.
 *
 * Devuelve:
 *  - registry: estado de los 20 slots del GetBlock Registry
 *  - relayer:  estado de los clusters Round-Robin
 *  - router:   estado del GlobalRPCRouter
 *  - summary:  métricas de resumen
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Protección básica  solo accesible con el CRON_SECRET o en desarrollo
    // "Bearer undefined" passed the old check whenever CRON_SECRET was unset.
    const isAuthorized = isCronAuthorized(request);

    if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const registry  = getEndpointSummary();
        const relayer   = RpcRelayerManager.getClusterStatus();
        const router    = GlobalRPCRouter.getPoolStatus();
        const active    = getActiveCount();
        const covered   = getCoveredChains();

        // Calcular porcentaje de cobertura
        const total = registry.length; // 20
        const configured = registry.filter(e => e.isActive).length;
        const pendingSlots = registry.filter(e => !e.isActive).map(e => ({
            slot: e.slot,
            chain: e.chain,
            protocol: e.protocol,
            envKey: e.envKey,
        }));

        return NextResponse.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            summary: {
                totalSlots: total,
                configuredSlots: configured,
                pendingSlots: total - configured,
                coveragePercent: Math.round((configured / total) * 100),
                chainsWithGetBlock: covered,
            },
            pendingSlots,
            registry,
            relayer,
            router,
        }, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store',
                'X-GetBlock-Active': String(active),
            },
        });
    } catch (err: any) {
        console.error('[GetBlock Health API] Error:', err);
        return NextResponse.json(
            { status: 'ERROR', error: 'Health check failed' },
            { status: 500 }
        );
    }
}
