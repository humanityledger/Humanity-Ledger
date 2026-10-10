import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = { id: session.userId, email: session.email };

        const email = user.email;
        const authUser = await (prisma as any).authUser.findUnique({
            where: { id: user.id },
            include: { timeLockVaults: true }
        }) as any;

        if (!authUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json({ vaults: authUser.timeLockVaults || [] });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

