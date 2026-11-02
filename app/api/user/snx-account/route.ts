import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

/**
 * POST: Associate a Synthetix Account ID with the authenticated user's wallet.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        const authUserId = session?.userId;
        
        if (!authUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { snxAccountId, walletAddress } = await req.json();

        if (!snxAccountId || !walletAddress) {
            return NextResponse.json({ error: 'snxAccountId and walletAddress are required' }, { status: 400 });
        }

        // ️ [SECURITY] Hard-bind to the authenticated SIWE user
        if (walletAddress.toLowerCase() !== authUserId.toLowerCase()) {
             return NextResponse.json({ error: 'Wallet not associated with this session' }, { status: 403 });
        }

        const existingUser = await prisma.user.findFirst({
            where: { walletAddress: authUserId.toLowerCase() }
        });

        if (!existingUser) {
            return NextResponse.json({ error: 'Wallet not registered' }, { status: 403 });
        }

        const user = await prisma.user.update({
            where: { walletAddress: authUserId.toLowerCase() },
            data: { 
                snxAccountId: snxAccountId.toString(),
                lastActive: new Date()
            }
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Synthetix Account synchronized',
            snxAccountId: user.snxAccountId
        });

    } catch (error: any) {
        console.error('[SNX_ACCOUNT_SYNC_ERROR]', error);
        return NextResponse.json({ 
            error: 'Failed to synchronize account', 
            details: 'Error details redacted' 
        }, { status: 500 });
    }
}

/**
 * GET: Retrieve the SNX account for the user
 */
export async function GET(req: NextRequest) {
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ snxAccountId: null }, { status: 401 });
    }
    const address = session.userId.toLowerCase();

    try {
        const user = await prisma.user.findUnique({
            where: { walletAddress: address.toLowerCase() },
            select: { snxAccountId: true }
        });
        return NextResponse.json({ snxAccountId: user?.snxAccountId || null });
    } catch (e) {
        return NextResponse.json({ snxAccountId: null });
    }
}

