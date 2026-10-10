import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const users = await prisma.user.findMany({
            take: 50,
            where: {
                OR: [
                    { forumTopics: { some: {} } },
                    { forumPosts: { some: {} } }
                ]
            },
            include: {
                _count: {
                    select: {
                        forumTopics: true,
                        forumPosts: true,
                        forumLikes: true
                    }
                }
            }
        });

        // Calculate a dynamic prestige score
        // 10 points per topic, 5 per post, 2 per like given/received (approx)
        const rankedUsers = users.map(u => ({
            id: u.id,
            walletAddress: u.walletAddress,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
            tier: u.tier,
            isPro: u.isPro,
            stats: {
                topics: u._count.forumTopics,
                posts: u._count.forumPosts,
                likes: u._count.forumLikes
            },
            prestigeScore: (u._count.forumTopics * 10) + (u._count.forumPosts * 5) + (u._count.forumLikes * 2)
        })).sort((a, b) => b.prestigeScore - a.prestigeScore);

        return NextResponse.json({ success: true, users: rankedUsers });
    } catch (e: any) {
        console.warn("[Leaderboard GET Error]:", e.message);
        return NextResponse.json({ success: false, users: [], error: 'Internal Server Error' });
    }
}
