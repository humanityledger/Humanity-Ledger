import { NextResponse } from 'next/server';
import { getSequencerOverview } from '@/lib/aztec/sequencer/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/aztec/sequencer/overview
 *
 * Everything the operator dashboard shows, read live from the Aztec node
 * JSON-RPC and the Aztec L1 contracts. Values that could not be read come
 * back as { ok: false, error }, never as invented numbers.
 * Signed-in only (middleware). The internal node URL is not returned.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const overview = await getSequencerOverview();
    const body = {
      ...overview,
      ownNode: { ...overview.ownNode, url: overview.ownNode.url ? 'configured' : null },
    };
    return NextResponse.json({ success: true, data: body }, { headers: { 'Cache-Control': 'private, max-age=5' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
