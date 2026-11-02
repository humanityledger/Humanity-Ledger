import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { transactionService } from '@/lib/wallet/transaction-service';
import { z } from 'zod';

const ExecuteSchema = z.object({
  mode: z.enum(['send', 'swap', 'bridge', 'buy']),
  to: z.string().optional(),
  amount: z.number().positive(),
  fromAsset: z.string(),
  toAsset: z.string().optional(),
  fromChain: z.number(),
  toChain: z.number(),
  quoteId: z.string().optional(),
  subMode: z.string().optional()
});

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const ens = searchParams.get('ens');
    if (ens) {
        const address = await transactionService.resolveENS(ens);
        return NextResponse.json({ address });
    }
    return NextResponse.json({ error: 'Missing ens parameter' }, { status: 400 });
}

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

    // 2. Validate Body
    const body = await req.json();
    const validated = ExecuteSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validated.error }, { status: 400 });
    }

    // 3. Execute via Service
    const txHash = await transactionService.execute({
        userId: authUser.walletAddress,
        ...validated.data
    });

    return NextResponse.json({ 
        success: true, 
        txHash,
        message: `${validated.data.mode.toUpperCase()} initiated successfully.`
    });

  } catch (error: any) {
    console.error('Execute Engine Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

