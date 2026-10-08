import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = { id: session.userId, email: session.email };

        const { strategy, portfolio } = await req.json();

        const email = user.email;
        const authUser = await prisma.authUser.findUnique({ where: { email } });

        if (!authUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Simple AI Logic Simulation:
        // Adjust weights based on strategy
        let plan = [];
        if (strategy === 'AGRESSIVE') {
            plan = [
                { token: 'ETH', target: '40%' },
                { token: 'USDC', target: '10%' },
                { token: 'WBTC', target: '50%' }
            ];
        } else {
            plan = [
                { token: 'ETH', target: '30%' },
                { token: 'USDC', target: '50%' },
                { token: 'WBTC', target: '20%' }
            ];
        }

        const rebalancerPlan = await prisma.aIRebalancerPlan.create({
            data: {
                userId: authUser.id,
                strategy: strategy,
                payload: { current: portfolio, target: plan, recommendedSwaps: ["USDC -> WBTC", "ETH -> WBTC"] },
                executed: false,
            }
        });

        return NextResponse.json({ success: true, plan: rebalancerPlan });

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

