import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

/**
 * LEGENDARY TRANSACTION STATUS TRACKER
 * Monitors blockchain transactions and updates database status
 * 
 * GET /api/wallet/transaction/status?txHash=0x...&chainId=1
 * Returns: { status: 'PENDING' | 'CONFIRMED' | 'FAILED', receipt?: object }
 */

export async function GET(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = { id: session.userId, email: session.email };

        const { searchParams } = new URL(req.url);
        const txHash = searchParams.get('txHash');
        const chainId = searchParams.get('chainId');

        if (!txHash) {
            return NextResponse.json({ error: 'Transaction hash required' }, { status: 400 });
        }

        // 1. Get transaction from database
        const transaction = await (prisma as any).transaction.findUnique({
            where: { hash: txHash }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // 2. If already confirmed or failed, return cached status
        if (transaction.status === 'CONFIRMED' || transaction.status === 'FAILED') {
            return NextResponse.json({
                status: transaction.status,
                txHash: transaction.hash,
                blockNumber: transaction.blockNumber,
                timestamp: transaction.timestamp
            });
        }

        // 3. Check blockchain for current status
        const { ethers } = await import('ethers');
        const { getChainById } = await import('@/lib/wallet/chains');
        
        const chain = getChainById(Number(chainId || transaction.chainId));
        if (!chain) {
            return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
        }

        const provider = new ethers.JsonRpcProvider(chain.rpcUrls[0]);
        
        try {
            const receipt = await provider.getTransactionReceipt(txHash);
            
            if (!receipt) {
                // Transaction still pending
                return NextResponse.json({
                    status: 'PENDING',
                    txHash: transaction.hash
                });
            }

            // Transaction confirmed
            const status = receipt.status === 1 ? 'CONFIRMED' : 'FAILED';
            
            // Update database
            await (prisma as any).transaction.update({
                where: { hash: txHash },
                data: {
                    status,
                    blockNumber: Number(receipt.blockNumber),
                    timestamp: new Date()
                }
            });

            return NextResponse.json({
                status,
                txHash: transaction.hash,
                blockNumber: Number(receipt.blockNumber),
                gasUsed: receipt.gasUsed.toString(),
                effectiveGasPrice: receipt.gasPrice?.toString(),
                receipt: {
                    blockHash: receipt.blockHash,
                    blockNumber: Number(receipt.blockNumber),
                    transactionIndex: receipt.index,
                    from: receipt.from,
                    to: receipt.to,
                    gasUsed: receipt.gasUsed.toString(),
                    status: receipt.status
                }
            });

        } catch (error: any) {
            console.error('Error fetching transaction receipt:', error);
            
            // If error is "transaction not found", it might still be pending
            if (error.message?.includes('not found')) {
                return NextResponse.json({
                    status: 'PENDING',
                    txHash: transaction.hash
                });
            }
            
            throw error;
        }

    } catch (error: any) {
        console.error('Transaction status check error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

