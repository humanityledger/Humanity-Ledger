import { NextResponse } from 'next/server';
import { getSequencerOverview } from '@/lib/aztec/sequencer/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/aztec/sequencer/health
 *
 * 200 when our node is READY and no critical alert is open, 503 otherwise.
 * Meant for an uptime monitor that holds a session; the container itself is
 * health-checked on the node's own GET /status.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const o = await getSequencerOverview();
    const critical = o.alerts.filter(a => a.level === 'critical');
    const healthy = o.ownNode.mode === 'READY' && critical.length === 0;
    return NextResponse.json(
      {
        success: true,
        data: {
          healthy,
          network: o.network.id,
          node: o.ownNode.mode,
          nodeVersion: o.ownNode.info?.nodeVersion ?? null,
          lagBlocks: o.ownNode.lagBlocks,
          critical: critical.map(a => a.code),
          checkedAt: o.generatedAt,
        },
      },
      { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 503 });
  }
}
