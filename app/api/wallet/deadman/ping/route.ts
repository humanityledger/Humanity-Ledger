import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = { id: session.userId, email: session.email };

        const email = user.email;
        const authUser = await prisma.authUser.findUnique({ where: { email } });

        if (!authUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // DeadMansSwitch unique key is `userAddress`, not userId
        const userAddress = authUser.walletAddress || session.userId;

        await prisma.deadMansSwitch.update({
            where: { userAddress },
            data: { lastPing: new Date() }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

