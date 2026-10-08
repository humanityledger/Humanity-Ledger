import { NextRequest, NextResponse } from 'next/server';
import { polymarketRouterService } from '@/lib/blockchain/PolymarketRouterService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { marketId, direction, amount, userAddress } = body;

        if (!marketId || !direction || !amount || !userAddress) {
            return NextResponse.json({ error: 'Faltan parámetros de ejecución (Attest Payload)' }, { status: 400 });
        }

        if (direction !== 'YES' && direction !== 'NO') {
            return NextResponse.json({ error: 'Dirección inválida, debe ser YES o NO' }, { status: 400 });
        }

        const txPayload = await polymarketRouterService.buildAttestTransaction(
            marketId,
            direction,
            amount
        );

        return NextResponse.json({
            tx: txPayload.tx
        });

    } catch (error: any) {
        console.error('[POLY_API_ATTEST]', error.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
