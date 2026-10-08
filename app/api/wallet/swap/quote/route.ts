import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { formatUnits } from 'viem';

const ONEINCH_API = 'https://api.1inch.dev/swap/v6.0/1'; // Ethereum mainnet

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = { id: session.userId, email: session.email };

        const { fromToken, toToken, amount } = await req.json();

        // Token address mapping (Ethereum mainnet)
        const tokenAddresses: Record<string, string> = {
            'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        };

        const fromTokenAddress = tokenAddresses[fromToken];
        const toTokenAddress = tokenAddresses[toToken];

        if (!fromTokenAddress || !toTokenAddress) {
            return NextResponse.json({ error: 'Unsupported token' }, { status: 400 });
        }

        // Get quote from 1inch
        const quoteUrl = `${ONEINCH_API}/quote?src=${fromTokenAddress}&dst=${toTokenAddress}&amount=${amount}`;
        
        const quoteRes = await fetch(quoteUrl, {
            headers: {
                'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
            },
        });

        if (!quoteRes.ok) {
            throw new Error('Failed to fetch 1inch quote');
        }

        const quoteData = await quoteRes.json();

        const resultDecimals = toToken === 'ETH' || toToken === 'DAI' ? 18 : 6;
        const toAmountFormatted = (BigInt(quoteData.toAmount) / BigInt(10 ** resultDecimals)).toString();

        return NextResponse.json({
            toAmount: parseFloat(formatUnits(BigInt(quoteData.toAmount), resultDecimals)).toFixed(4),
            rate: (parseFloat(formatUnits(BigInt(quoteData.toAmount), resultDecimals)) / parseFloat(formatUnits(BigInt(amount), 18))).toFixed(4),
            gasFee: (parseInt(quoteData.gas) * 10 / 1e9).toFixed(2), // Rough estimate
        });

    } catch (error: any) {
        console.error('Swap quote error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

