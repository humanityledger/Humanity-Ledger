import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/**
 * /api/zk/transfer — Server-side Aztec shielded transfer relay stub.
 * Real transfers require Aztec testnet PXE.
 */

// POST /api/zk/transfer — Submit a shielded transfer
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

// GET /api/zk/transfer — Query transaction history
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'Aztec testnet PXE not connected', message: 'Aztec testnet PXE not connected' },
    { status: 503 }
  );
}
