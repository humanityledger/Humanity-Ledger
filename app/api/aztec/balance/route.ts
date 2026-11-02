import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { isOwner } from '@/lib/aztec/zk-identity';

export const dynamic = 'force-dynamic';

/**
 * GET /api/aztec/balance?aztecAddress=0x...
 *
 * Returns the authoritative QDs balance for a given address.
 * Uses User.creditsBalance as the single source of truth (updated atomically
 * by the transfer route). Auto-upserts the User row with 2500 QD default
 * if it doesn't exist yet (first-time SIWE users who connected but never
 * had a User row created during auth).
 *
 * CRITICAL FIX: The old balance API aggregated from Transaction/QdTransaction
 * tables but the transfer route reads/writes User.creditsBalance — creating a
 * mismatch where users saw 0 balance even though the DB said 2500. Now unified.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const aztecAddress = searchParams.get('aztecAddress');

  if (!aztecAddress) {
    return NextResponse.json({ error: 'Missing aztecAddress parameter.' }, { status: 400 });
  }

  const normalizedAddress = aztecAddress.toLowerCase();

  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve UUID to wallet address for email users
  let sessionAddr = session.userId.toLowerCase();
  if (sessionAddr.includes('-') && sessionAddr.length > 30) {
    try {
      const authUser = await prisma.authUser.findUnique({ where: { id: session.userId } });
      if (authUser?.walletAddress) sessionAddr = authUser.walletAddress.toLowerCase();
    } catch {}
  }

  if (!isOwner(sessionAddr, normalizedAddress) && sessionAddr !== normalizedAddress) {
    return NextResponse.json({ error: 'Forbidden: Private Aztec balance is encrypted.' }, { status: 403 });
  }

  try {
    // AUTO-UPSERT: Ensure the User row exists with the default 2500 QD genesis balance.
    // This is the AUTHORITATIVE balance column — the transfer route atomically writes to it.
    // If the user is new (no row yet), we create it here so they see 2500 QD immediately.
    const user = await prisma.user.upsert({
      where: { walletAddress: normalizedAddress },
      update: {}, // No-op update — just return the existing row unchanged
      create: {
        walletAddress: normalizedAddress,
        creditsBalance: 2500, // Default genesis balance per schema @default(2500)
        tier: 'FREE',
        humanityScore: 0,
      },
      select: { creditsBalance: true }
    });

    const finalBalance = Math.max(0, user.creditsBalance);
    const rawBaseUnits = Math.round(finalBalance * 1e8);

    console.log(`[Aztec Ledger] ${normalizedAddress.slice(0, 10)}… → ${finalBalance} QDs`);

    return NextResponse.json({
      balance: finalBalance.toFixed(2),
      raw: rawBaseUnits.toString(),
      rawScale: '1e8',
      symbol: 'QDs',
      network: 'aztec-mainnet',
      address: aztecAddress,
    });

  } catch (err: any) {
    console.error('[Aztec Balance Error]', err.message);
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
