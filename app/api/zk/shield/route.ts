import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/**
 * /api/zk/shield — Shield L1 funds into Aztec shielded notes stub.
 * Real shielding requires Aztec testnet PXE.
 */

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'Aztec testnet PXE not connected', message: 'Aztec testnet PXE not connected' },
    { status: 503 }
  );
}
