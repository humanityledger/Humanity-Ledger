import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const email = session.email;
        // AuthUser has NO relation to DeadMansSwitch  query directly by userAddress
        const authUser = await prisma.authUser.findUnique({ where: { email } });
        if (!authUser) return NextResponse.json({ active: false });

        const userAddress = authUser.walletAddress || session.userId;
        const deadMan = await prisma.deadMansSwitch.findUnique({ where: { userAddress } });

        if (!deadMan) {
            return NextResponse.json({ active: false });
        }

        return NextResponse.json({
            active: deadMan.active,
            beneficiary: deadMan.beneficiary,
            inactivityPeriod: deadMan.inactivityPeriod,
            lastPing: deadMan.lastPing,
        });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
