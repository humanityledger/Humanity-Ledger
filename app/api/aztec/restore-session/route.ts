import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deriveAztecAddress } from '@/lib/aztec/zk-identity';

export const dynamic = 'force-dynamic';

/**
 * POST /api/aztec/restore-session
 *
 * Restores a returning user's Sovereign Identity session WITHOUT re-triggering
 * the airdrop. This is the idempotent "login" path for users who already
 * claimed their QDs.
 *
 * Algorithm:
 *  1. Derive the canonical Aztec address from the EVM address (deterministic).
 *  2. Check the DB for any AIRDROP transaction to ANY derived candidate address
 *     that could belong to this EVM address (EVM-derived, entropy-derived, etc.)
 *  3. Return the address that actually has QDs with a balance snapshot.
 *
 * Body: { evmAddress: string, candidateAddress?: string }
 * Returns: { found: boolean, aztecAddress: string | null, balance: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const evmAddress: string = body.evmAddress?.toLowerCase()?.trim() ?? '';
    const candidateAddress: string = body.candidateAddress?.toLowerCase()?.trim() ?? '';

    if (!evmAddress && !candidateAddress) {
      return NextResponse.json({ error: 'evmAddress or candidateAddress required.' }, { status: 400 });
    }

    // Build a list of candidate addresses to check in the DB.
    // We try multiple derivation paths because the user might have connected
    // before or after we changed the derivation algorithm.
    const candidates = new Set<string>();

    if (candidateAddress && candidateAddress.startsWith('0x') && candidateAddress.length >= 42) {
      candidates.add(candidateAddress);
    }

    if (evmAddress && evmAddress.startsWith('0x')) {
      // Path 1: Deterministic SHA-256 derivation (primary path)
      try {
        const derived = deriveAztecAddress(evmAddress);
        if (derived) candidates.add(derived.toLowerCase());
      } catch {}

      // Path 2: The EVM address itself (early users before derivation was implemented)
      candidates.add(evmAddress);
    }

    // Search all candidates for existing airdrop claims
    const candidateArray = Array.from(candidates);

    // Find any AIRDROP transaction for any of the candidate addresses
    const existingClaim = await prisma.transaction.findFirst({
      where: {
        toAddress: { in: candidateArray },
        token: 'QDs',
        type: 'AIRDROP',
        status: 'COMPLETED',
      },
      orderBy: { timestamp: 'asc' }, // Pick the earliest (genesis) claim
      select: {
        toAddress: true,
        amount: true,
        timestamp: true,
        txHash: true,
      },
    });

    if (!existingClaim) {
      // No prior claim found — user needs to claim for the first time
      return NextResponse.json({ found: false, aztecAddress: null, balance: 0 });
    }

    const canonicalAddress = existingClaim.toAddress.toLowerCase();

    // Calculate live balance for the canonical address
    const [receivedAgg, sentAgg, earnedAgg, spentAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: { toAddress: canonicalAddress, token: 'QDs', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { fromAddress: canonicalAddress, token: 'QDs', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.qdTransaction.aggregate({
        where: { aztecAddress: canonicalAddress, type: 'EARN' },
        _sum: { amount: true },
      }),
      prisma.qdTransaction.aggregate({
        where: { aztecAddress: canonicalAddress, type: { in: ['SPEND', 'SLASH', 'FEE'] } },
        _sum: { amount: true },
      }),
    ]);

    const received = Number(receivedAgg._sum.amount ?? 0);
    const sent     = Number(sentAgg._sum.amount     ?? 0);
    const earned   = Number(earnedAgg._sum.amount   ?? 0);
    const spent    = Number(spentAgg._sum.amount     ?? 0);
    const balance  = Math.max(0, Math.round((received + earned - sent - spent) * 1_000_000) / 1_000_000);

    return NextResponse.json({
      found: true,
      aztecAddress: canonicalAddress,
      balance,
      claimedAt: existingClaim.timestamp,
      txHash: existingClaim.txHash,
    });

  } catch (err: any) {
    console.error('[RestoreSession] Error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

