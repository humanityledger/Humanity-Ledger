import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { transactionService } from '@/lib/wallet/transaction-service';
import { z } from 'zod';

const SendSchema = z.object({
  to: z.string().min(40), // Basic address length check
  amount: z.number().positive(),
  asset: z.string(),
  network: z.enum(['ETH', 'POLYGON', 'BASE']).default('ETH')
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Resolve User
    const authUser = await prisma.authUser.findUnique({
        where: { email: session.user.email },
        select: { walletAddress: true, id: true }
    });

    if (!authUser || !authUser.walletAddress) {
         return NextResponse.json({ error: 'No wallet linked' }, { status: 400 });
    }

    // 2. Validate
    const body = await req.json();
    const validated = SendSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validated.error }, { status: 400 });
    }

    const { to, amount, asset, network } = validated.data;

    // 3. Execute Real Transaction
    // NOTE: In a real exchange, we would check 'ExchangeBalance' first to ensure they own the funds internally.
    // For this specific 'User Owns Wallet' architecture, we rely on the blockchain rejection if funds are insufficient.
    
    const txHash = await transactionService.sendTransaction(
        authUser.walletAddress,
        to,
        amount,
        asset,
        network
    );

    // 4. Record in Database? (Optional/Future: 'Withdrawal' model)

    return NextResponse.json({ 
        success: true, 
        txHash,
        explorerUrl: `https://etherscan.io/tx/${txHash}` 
    });

  } catch (error: any) {
    console.error('Send Transaction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

