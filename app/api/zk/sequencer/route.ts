import { NextResponse } from 'next/server';
import { isZkEnabled } from '@/lib/features/zk';

/**
 * I-003 / H-018: ZK Sequencer Status API
 * Removed simulated batches generated with Math.random().
 * Only serves data if a real Aztec sequencer RPC endpoint is configured.
 */
export async function GET() {
  const aztecRpc = process.env.AZTEC_NODE_URL;

  if (!isZkEnabled || !aztecRpc) {
    return NextResponse.json(
      {
        status: 'disabled',
        message: 'Aztec sequencer integration requires NEXT_PUBLIC_ZK_MODE=testnet and AZTEC_NODE_URL.',
        batches: [],
      },
      { status: 200 }
    );
  }

  try {
    const res = await fetch(`${aztecRpc}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return NextResponse.json({ status: 'unreachable', batches: [] }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: 'Failed to query Aztec sequencer node' },
      { status: 502 }
    );
  }
}
