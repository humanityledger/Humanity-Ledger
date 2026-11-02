import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { beneficiary, months } = await req.json();

        const email = session.email;
        const authUser = await prisma.authUser.findUnique({ where: { email } });

        if (!authUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // DeadMansSwitch schema: unique key = `userAddress`, fields = `beneficiary`, `inactivityPeriod`, `lastPing`, `active`
        const userAddress = authUser.walletAddress || session.userId;

        const deadMan = await prisma.deadMansSwitch.upsert({
            where: { userAddress },
            update: {
                beneficiary,
                inactivityPeriod: parseInt(months) * 30 * 24 * 3600, // months -> seconds
                lastPing: new Date(),
                active: true
            },
            create: {
                userAddress,
                beneficiary,
                inactivityPeriod: parseInt(months) * 30 * 24 * 3600,
                active: true
            }
        });

        return NextResponse.json({ success: true, deadMan });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
