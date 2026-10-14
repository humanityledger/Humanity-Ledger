import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const now = Date.now();

  // Simulated Aztec Rollup state
  const rollupBlockHeight = 14824;
  const currentEpoch = 463;

  return NextResponse.json({
    network: 'aztec-mainnet',
    rollupBlockHeight,
    currentEpoch,
    roots: {
      noteHashTreeRoot: '0x18ab4c9e83017f8a7bc65293da2e19b88523c9ff0910e527a92b2384a861fbc1',
      nullifierTreeRoot: '0x29cc7312f45819e64e10b10695123d4a652391bde4c379201582e0854619bfae',
      publicDataTreeRoot: '0x09da41527abecf9810293481231fbe61823749acbd01928374aefb10928374ae',
      l1ToL2MessageTreeRoot: '0x7182938471928374192837491827394819283749182739481928374918273948',
    },
    syncStatus: {
      isSynced: true,
      pendingRollupBatches: 2,
      estimatedTimeNextBlockMs: 8500,
    },
    address: address || null,
    timestamp: now,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.noteCommitment && !body?.nullifier) {
    return NextResponse.json({ error: 'noteCommitment or nullifier required' }, { status: 400 });
  }

  return NextResponse.json({
    status: 'included_in_mempool',
    txHash: '0x' + Math.random().toString(36).substring(2, 18),
    estimatedBlock: 14825,
    timestamp: Date.now(),
  });
}
