import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

const OWNER_WALLET = '0x78831c25c86ea2a78a6127fc2ccb95e612d87b4a';
const PERMANENT_DATE = new Date('2099-12-31T23:59:59Z');

/**
 * Owner Provisioning — auto-grants permanent ARCHIVE_PROVER access to the owner wallet.
 * Called automatically on dashboard load.
 */
export async function POST(req: NextRequest) {
    try {
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
