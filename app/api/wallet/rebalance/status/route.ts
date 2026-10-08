import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // AIRebalancerPlan has no relation to AuthUser  query directly by userId
        const plans = await prisma.aIRebalancerPlan.findMany({
            where: { userId: session.userId },
            orderBy: { createdAt: 'desc' },
            take: 1
        });

        if (plans.length === 0) {
            return NextResponse.json({ plan: null });
        }

        return NextResponse.json({ plan: plans[0] });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
