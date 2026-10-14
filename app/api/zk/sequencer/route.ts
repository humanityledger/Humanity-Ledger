import { NextRequest, NextResponse } from 'next/server';

// Sequencer simulation: manages rollup batch submission and epoch transitions
interface RollupBatch {
  batchId: string;
  epoch: number;
  blockNumber: number;
  transactions: number;
  l1TxHash?: string;
  status: 'accumulating' | 'proving' | 'verified' | 'submitted' | 'finalized';
  gasAmortized: string;
  timestamp: number;
  proverTimeMs: number;
  circuitConstraints: number;
}

const BATCH_INTERVAL_MS = 12_000; // 12 second simulated rollup block
let currentEpoch = 463;
let currentBlock = 14824;
let batchHistory: RollupBatch[] = [];

function generateBatch(): RollupBatch {
  currentBlock++;
  const txCount = Math.floor(Math.random() * 48) + 2;
  const proverTime = 800 + Math.floor(Math.random() * 1200);

  const batch: RollupBatch = {
    batchId: `0xbatch_${currentBlock}_${Math.random().toString(36).substring(2, 8)}`,
    epoch: currentEpoch,
    blockNumber: currentBlock,
    transactions: txCount,
    l1TxHash: `0x${Math.random().toString(36).substring(2, 18)}`,
    status: 'finalized',
    gasAmortized: (0.001 / txCount).toFixed(6) + ' ETH/tx',
    timestamp: Date.now(),
    proverTimeMs: proverTime,
    circuitConstraints: txCount * 24_512,
  };

  batchHistory.unshift(batch);
  if (batchHistory.length > 50) batchHistory = batchHistory.slice(0, 50);

  if (currentBlock % 12 === 0) currentEpoch++;
  return batch;
}

// Initialize with some history
if (batchHistory.length === 0) {
  for (let i = 0; i < 8; i++) {
    generateBatch();
  }
}

export async function GET(req: NextRequest) {
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get('limit') || '20'));

  return NextResponse.json({
    network: 'aztec-mainnet',
    currentBlock,
    currentEpoch,
    batches: batchHistory.slice(0, limit),
    sequencerMetrics: {
      avgTxPerBatch: batchHistory.length > 0
        ? (batchHistory.reduce((s, b) => s + b.transactions, 0) / batchHistory.length).toFixed(1)
        : '0',
      avgProverTimeMs: batchHistory.length > 0
        ? Math.round(batchHistory.reduce((s, b) => s + b.proverTimeMs, 0) / batchHistory.length)
        : 0,
      totalTxProcessed: batchHistory.reduce((s, b) => s + b.transactions, 0),
      avgGasSavedVsL1: '99.4%',
    },
    timestamp: Date.now(),
  });
}

export async function POST(req: NextRequest) {
  // Simulate submitting a new transaction to the sequencer mempool
  const body = await req.json().catch(() => null);
  if (!body?.proofHex || !body?.publicInputs) {
    return NextResponse.json({ error: 'proofHex and publicInputs required' }, { status: 400 });
  }

  const mempoolId = `zkm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  return NextResponse.json({
    success: true,
    mempoolId,
    status: 'pending_batch_inclusion',
    estimatedBlockInclusion: currentBlock + 1,
    estimatedEpoch: currentEpoch,
    note: 'Transaction will be included in the next Aztec rollup block (~12 seconds)',
    timestamp: Date.now(),
  });
}
