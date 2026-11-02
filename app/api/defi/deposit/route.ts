import { NextRequest, NextResponse } from 'next/server';
import { defiRouterService } from '@/lib/blockchain/DeFiRouterService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { chain, poolAddress, amount, userAddress } = body;

        if (!chain || !poolAddress || !amount || !userAddress) {
            return NextResponse.json({ error: 'Missing parameters in deposit execution' }, { status: 400 });
        }

        const route = await defiRouterService.buildDepositTransaction(
            chain,
            poolAddress, // The DeFiLlama pool address representing the receipt token
            amount,
            userAddress
        );

        return NextResponse.json({
            tx: route.tx,
            estimatedGas: route.gas,
            expectedOutput: route.expectedOutput
        });

    } catch (error: any) {
        console.error('[DeFi_API_Deposit]', error.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
