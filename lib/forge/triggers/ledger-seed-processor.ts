import { Queue } from 'bullmq';
import { createRedisClient } from '@/lib/redis/client';
import { FORGE_ENABLED, TIER_THRESHOLDS } from '../index';

const connection = createRedisClient({ name: 'CosmicForgeQueue' });
const isMock = !connection || (connection as any).__isMock || (connection as any).__isBuildMock;
const forgeQueue = isMock ? null : new Queue('forge-seed', { connection });

export class LedgerSeedProcessor {
    /**
     * Call this from the main Ingestion Engine whenever a ledger event > 1M is saved.
     */
    static async tryInjectSeed(eventId: string, amountUSD: number, chain: string, timestamp: number = Date.now()) {
        if (!FORGE_ENABLED || !forgeQueue) return;
        
        // Only Narwhal and above triggers the Forge (Z-score 3.5σ implicit loosely translates to > $1M here)
        if (amountUSD < TIER_THRESHOLDS.NARWHAL) return;

        try {
            await forgeQueue.add('process-seed', {
                eventId,
                amountUSD,
                chain,
                timestamp
            }, {
                jobId: `forge-seed-${eventId}`, // Prevent duplicates natively in BullMQ
                removeOnComplete: true,
                removeOnFail: false
            });
            console.log(`[LedgerSeedProcessor]  Injected event ${eventId} ($${amountUSD}) into Data Studio`);
        } catch (e) {
            console.error('[LedgerSeedProcessor] Failed to inject seed to queue.', e);
        }
    }
}
