import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
    try {
        const session = await getSession();
    const address = session?.userId;
        if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const users = await (prisma as any).user.findMany({
            where: {
                OR: [
                    { forumPosts: { some: {} } },
                    { forumTopics: { some: {} } }
                ]
            },
            select: {
                walletAddress: true,
                tier: true,
                isPro: true,
                _count: {
                    select: {
                        forumPosts: true,
                        forumTopics: true,
                        forumLikes: true
                    }
                }
            },
            take: 50
        });

        // Sort in memory by activity score
        const sortedUsers = users.sort((a: any, b: any) => {
            const scoreA = a._count.forumPosts + (a._count.forumTopics * 2) + a._count.forumLikes;
            const scoreB = b._count.forumPosts + (b._count.forumTopics * 2) + b._count.forumLikes;
            return scoreB - scoreA;
        });

        return NextResponse.json(sortedUsers);
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
