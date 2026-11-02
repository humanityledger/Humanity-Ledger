import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { ethers } from 'ethers';

const provider = new ethers.AlchemyProvider('mainnet', process.env.ALCHEMY_API_KEY || '');

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = { id: session.userId, email: session.email };

        const { to, amount } = await req.json();

        // Get current gas price
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || BigInt(0);
        
        // Standard transfer gas limit
        const gasLimit = 21000;
        
        // Calculate total gas fee in ETH
        const gasFeeWei = gasPrice * BigInt(gasLimit);
        const gasFeeETH = ethers.formatEther(gasFeeWei);
        
        // Rough USD conversion (assume ETH = $3000)
        const ethPrice = 3000;
        const gasFeeUSD = (parseFloat(gasFeeETH) * ethPrice).toFixed(2);

        return NextResponse.json({
            gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
            gasLimit,
            gasFeeETH,
            gasFeeUSD,
        });

    } catch (error: any) {
        console.error('Gas estimation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

