/**
 * GET /api/status/alpha — measured data only (package 6): counts of the delivery and payment
 * reports over the last 24 hours, whether the Aztec Alpha node's block number is moving, and the
 * alerts those numbers raise (lib/ops/alerts.ts). No target, estimate or uptime claim is returned.
 * Public; nothing personal is in it. Read by /status and by the "Alpha alerts" workflow.
 */
import { NextResponse } from 'next/server';
import { readCounters } from '@/lib/ops/counters';
import { alphaAlerts, ALERT_THRESHOLDS } from '@/lib/ops/alerts';
import { PAYMENT_REASONS, PAYMENT_STAGES } from '@/lib/aztec/wallet/payment-report';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { AZTEC_NETWORKS } from '@/lib/aztec/sequencer/networks';

export const dynamic = 'force-dynamic';

const DELIVERY = ['send_published', 'send_failed', 'publish_gave_up', 'stream_failed', 'receive_unresolved'] as const;

async function nodeBlock(): Promise<number | null> {
  try {
    const res = await fetch(process.env.AZTEC_MAINNET_NODE_URL || AZTEC_NETWORKS.mainnet.publicNodeRpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'node_getBlockNumber', params: [] }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    });
    const body: any = await res.json().catch(() => null);
    const n = Number(body?.result);
    return res.ok && Number.isSafeInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Seconds since the block number last changed, from the previous reading kept in Redis. */
async function stalledSeconds(block: number | null, now: number): Promise<number | null> {
  if (block === null) return null;
  const prev = await safeRedisGet('ops:node:last');
  let last: { block: number; seenAt: number } | null = null;
  try { last = prev && prev !== 'TIMEOUT' ? JSON.parse(prev) : null; } catch { last = null; }
  if (!last || last.block !== block) {
    await safeRedisSet('ops:node:last', JSON.stringify({ block, seenAt: now }), 'EX', 86400);
    return 0;
  }
  return Math.max(0, Math.round((now - last.seenAt) / 1000));
}

export async function GET() {
  const now = Date.now();
  const [payments, failedByReason, delivery, block] = await Promise.all([
    readCounters('payment', PAYMENT_STAGES),
    readCounters('payment', PAYMENT_REASONS.map((r) => `failed_${r}`)),
    readCounters('delivery', DELIVERY),
    nodeBlock(),
  ]);
  const stalled = await stalledSeconds(block, now);
  const alerts = alphaAlerts({ payments, delivery, nodeStalledSeconds: stalled });
  return NextResponse.json(
    {
      measuredAt: new Date(now).toISOString(),
      window: '24h',
      network: 'Aztec Alpha',
      payments: { ...payments, failedByReason: Object.fromEntries(PAYMENT_REASONS.map((r) => [r, failedByReason[`failed_${r}`] ?? 0])) },
      delivery,
      node: { blockNumber: block, secondsSinceNewBlock: stalled },
      thresholds: ALERT_THRESHOLDS,
      alerts,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
