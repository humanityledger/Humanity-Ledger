import { NextRequest, NextResponse } from 'next/server';
import { 
  exportTransactionsToCSV,
  type TransactionType 
} from '@/lib/wallet/transactions';
import { 
  getTransactionHistory, 
  getTransactionStats
} from '@/lib/wallet/transactions-server';

/** Safe JSON serializer  converts BigInt to string to avoid JSON.stringify crash */
function safeStringify(data: unknown): string {
  return JSON.stringify(data, (_idx, v) =>
    typeof v === 'bigint' ? v.toString() : v
  );
}

/**
 * GET /api/wallet/transactions
 * Get transaction history for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    const authUserId = session.userId;

    const chainId = searchParams.get('chainId');
    const chainIds = searchParams.get('chainIds')?.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    const type = searchParams.get('type');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const format = searchParams.get('format');

    const transactions = await getTransactionHistory(authUserId, {
      chainId: chainId ? parseInt(chainId) : undefined,
      chainIds: chainIds && chainIds.length > 0 ? chainIds : undefined,
      type: type || undefined,
      limit: limit ? Math.max(1, Math.min(parseInt(limit, 10) || 50, 200)) : 50,
      offset: offset ? Math.max(0, parseInt(offset, 10) || 0) : 0,
    });

    // Export as CSV if requested
    if (format === 'csv') {
      const csv = exportTransactionsToCSV(transactions);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="transactions-${Date.now()}.csv"`,
        },
      });
    }

    // Use safe serializer to avoid BigInt crash
    return new NextResponse(safeStringify({ transactions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wallet/transactions/stats
 * Get transaction statistics
 */
export async function POST(request: NextRequest) {
  try {
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    const authUserId = session.userId;

    const stats = await getTransactionStats(authUserId);

    return new NextResponse(safeStringify({ stats }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction stats' },
      { status: 500 }
    );
  }
}
