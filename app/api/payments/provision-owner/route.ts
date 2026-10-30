import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

const OWNER_WALLET = process.env.OWNER_WALLET?.toLowerCase();
const PERMANENT_DATE = new Date('2099-12-31T23:59:59Z');

/**
 * Owner Provisioning — auto-grants permanent ARCHIVE_PROVER access to the owner wallet.
 * Called automatically on dashboard load. Fails closed if OWNER_WALLET is unset.
 */
export async function POST(req: NextRequest) {
    try {
        if (!OWNER_WALLET) {
            return NextResponse.json({ ok: false, error: 'Owner wallet provisioning is disabled (OWNER_WALLET unset).' }, { status: 503 });
        }
        const session = await getSession();
        const userId = session?.userId?.toLowerCase();

        if (!userId || userId !== OWNER_WALLET) {
            return NextResponse.json({ ok: false, reason: 'not_owner' }, { status: 403 });
        }

        await prisma.user.upsert({
            where: { walletAddress: userId },
            update: { tier: 'ARCHIVE_PROVER' },
            create: { walletAddress: userId, tier: 'ARCHIVE_PROVER' },
        });

        await prisma.subscription.upsert({
            where: { userId },
            update: { tier: 'ARCHIVE_PROVER', status: 'ACTIVE', expiresAt: PERMANENT_DATE },
            create: { userId, tier: 'ARCHIVE_PROVER', status: 'ACTIVE', expiresAt: PERMANENT_DATE },
        });

        return NextResponse.json({ ok: true, tier: 'ARCHIVE_PROVER' });
    } catch (e: any) {
        console.error('[OWNER_PROVISION_ERROR]', e);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
