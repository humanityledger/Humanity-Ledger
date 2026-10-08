import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
    getTransactionHistory 
} from '@/lib/wallet/transactions-server';

/**
 * [Elite] Transaction Registration API
 * Creates a PENDING entry in the DB immediately after broadcast.
 */
export async function POST(req: Request) {
    try {
        const { getSession } = await import('@/lib/session');
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
        }
        const userId = session.userId;

        const data = await req.json();
        const { hash, type, fromChain, toChain, fromToken, toToken, fromAmount, metadata } = data;

        if (!hash) {
            return NextResponse.json({ error: 'Missing hash' }, { status: 400 });
        }

        const tx = await prisma.blockchainTransaction.upsert({
            where: { txHash: hash },
            update: {
                status: data.status || 'PENDING_RELAY',
                updatedAt: new Date()
            },
            create: {
                txHash: hash,
                userId,
                blockNumber: metadata?.blockNumber || 0,
                type: type || 'SWAP',
                fromChain: fromChain?.toString() || '1',
                toChain: toChain?.toString() || '1',
                fromToken,
                toToken,
                fromAmount: fromAmount?.toString() || '0',
                status: 'PENDING_RELAY',
                metadata: metadata || {}
            }
        });

        console.log(`[ORCHESTRATOR] Registered transaction: ${hash}`);
        return NextResponse.json(tx);
    } catch (error: any) {
        console.error('[ORCHESTRATOR] API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


/**
 * Gets user transactions - Unified System Flow
 */
export async function GET(req: Request) {
    try {
        const { getSession } = await import('@/lib/session');
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
        }
        const userId = session.userId;

        //  UNIFICACIÓN DE EXPLORADOR (5000T) 
        // Ya no consultamos una sola tabla; usamos el motor de unificación.
        const transactions = await getTransactionHistory(userId, { limit: 50 });

        // Serialize BigInt to string to prevent JSON stringify crashes
        const safeTransactions = JSON.parse(JSON.stringify(transactions, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        return NextResponse.json(safeTransactions);
    } catch (error: any) {
        console.warn('[TransactionsAPI] Unified sync failed, returning empty list.', error.message);
        return NextResponse.json([]); 
    }
}

