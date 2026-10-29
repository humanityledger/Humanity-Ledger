import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sanitiseExplorerUrl } from '@/lib/aztec/client';
import { getSession } from '@/lib/session';
import { isOwner } from '@/lib/aztec/zk-identity';

export const dynamic = 'force-dynamic';

/**
 * GET /api/aztec/transactions?address=0x...
 *
 * Returns all QDs transactions (sends & receives) for a given Aztec address.
 * Used by the client to detect incoming transfers and credit the recipient's balance.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawAddress = searchParams.get('address');

  if (!rawAddress || !/^0x[0-9a-f]{64}$/i.test(rawAddress)) {
    return NextResponse.json({ error: 'Valid Aztec address required (0x + 64 hex chars)' }, { status: 400 });
  }

  const address = rawAddress.toLowerCase();
  
  const session = await getSession();
  if (!session?.userId) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isOwner(session.userId.toLowerCase(), address)) {
     return NextResponse.json({ error: 'Forbidden: Private Aztec transactions are encrypted.' }, { status: 403 });
  }

  try {
    const txs = await prisma.transaction.findMany({
      where: {
        token: 'QDs',
        OR: [
          { fromAddress: address },
          { toAddress:   address },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    const formatted = txs.map(tx => ({
      id:          tx.id,
      txHash:      (tx.metadata as any)?.aztecTxHash ?? tx.txHash,
      type:        tx.toAddress === address ? 'receive' : 'send',
      txType:      tx.type,  // TRANSFER | SPEND | AIRDROP
      reason:      (tx.metadata as any)?.reason ?? null,
      amount:      tx.amount,
      fromAddress: tx.fromAddress,
      toAddress:   tx.toAddress,
      timestamp:   tx.timestamp.toISOString(),
      blockNumber: tx.blockNumber?.toString() ?? '0',
      explorerUrl: sanitiseExplorerUrl((tx.metadata as any)?.explorerUrl ?? null),
    }));

    return NextResponse.json({ transactions: formatted });
  } catch (err: any) {
    console.error('[Aztec Transactions]', err.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
