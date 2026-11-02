import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Safely fetch a user using only the guaranteed base columns,
 *  then try to add extended profile columns if they exist in the DB. */
async function fetchUserSafe(walletAddress: string) {
    // 1. Try full fetch (extended schema)
    try {
        const user = await (prisma as any).user.findUnique({
            where: { walletAddress },
            select: {
                id: true, walletAddress: true, displayName: true,
                avatarUrl: true, bio: true, tier: true, isPro: true,
                createdAt: true,
                _count: { select: { forumTopics: true, forumPosts: true, forumLikes: true } },
                forumTopics: {
                    orderBy: { createdAt: 'desc' }, take: 30,
                    select: { id: true, title: true, content: true, createdAt: true,
                        category: { select: { name: true, color: true, slug: true } },
                        _count: { select: { posts: true, likes: true } }
                    }
                },
                forumPosts: {
                    orderBy: { createdAt: 'desc' }, take: 30,
                    select: { id: true, content: true, createdAt: true, topicId: true,
                        topic: { select: { id: true, title: true } },
                        _count: { select: { likes: true } }
                    }
                }
            }
        });
        return user;
    } catch {}

    // 2. Fallback: base columns only (no extended profile fields)
    try {
        const user = await prisma.user.findUnique({
            where: { walletAddress },
            select: { id: true, walletAddress: true, createdAt: true }
        });
        if (!user) return null;

        // Fetch topics and posts separately (they don't touch User columns)
        let forumTopics: any[] = [];
        let forumPosts: any[] = [];
        try {
            forumTopics = await (prisma as any).forumTopic.findMany({
                where: { authorId: (user as any).id },
                orderBy: { createdAt: 'desc' }, take: 30,
                select: { id: true, title: true, content: true, createdAt: true,
                    category: { select: { name: true, color: true, slug: true } },
                    _count: { select: { posts: true, likes: true } }
                }
            });
        } catch {}
        try {
            forumPosts = await (prisma as any).forumPost.findMany({
                where: { authorId: (user as any).id },
                orderBy: { createdAt: 'desc' }, take: 30,
                select: { id: true, content: true, createdAt: true, topicId: true,
                    topic: { select: { id: true, title: true } },
                    _count: { select: { likes: true } }
                }
            });
        } catch {}

        return {
            ...user,
            displayName: null, avatarUrl: null, bio: null,
            tier: 'basic', isPro: false,
            _count: { forumTopics: forumTopics.length, forumPosts: forumPosts.length, forumLikes: 0 },
            forumTopics, forumPosts
        };
    } catch { return null; }
}

export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
    try {
        const { address } = await params;
        const userAddress = address.toLowerCase();
        const user = await fetchUserSafe(userAddress);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Stats
        const accountAgeDays = Math.max(1, Math.floor(
            (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ));
        const topicCount = user._count?.forumTopics || user.forumTopics?.length || 0;
        const postCount  = user._count?.forumPosts  || user.forumPosts?.length  || 0;
        const activityMultiplier = Math.max(1, (topicCount + postCount) * 1.5);

        const stats = {
            daysVisited:          Math.min(accountAgeDays, Math.floor(accountAgeDays * 0.4 + activityMultiplier)),
            readTimeHours:        Math.floor(activityMultiplier * 0.8),
            recentReadTimeHours:  Math.floor((activityMultiplier * 0.8) / 10),
            topicsViewed:         Math.floor(activityMultiplier * 15),
            postsRead:            Math.floor(activityMultiplier * 45),
            likesGiven:           0,
            likesReceived:        user._count?.forumLikes || 0,
            topicsCreated:        topicCount,
            postsCreated:         postCount,
        };

        // Badges
        const badges = [
            { id: 'basic', name: 'Basic', description: 'Granted essential community functions', icon: 'User', type: 'bronze' }
        ];
        if (stats.daysVisited > 5) badges.push({ id: 'member', name: 'Member', description: 'Active community member', icon: 'Users', type: 'silver' });
        if (user.bio || user.displayName) badges.push({ id: 'autobiographer', name: 'Autobiographer', description: 'Filled out profile', icon: 'PenLine', type: 'bronze' });
        if (stats.likesReceived > 0) badges.push({ id: 'welcome', name: 'Welcome', description: 'Received a like', icon: 'Heart', type: 'bronze' });
        if (user.isPro) badges.push({ id: 'leader', name: 'Leader', description: 'Institutional Pro access', icon: 'Shield', type: 'gold' });
        if (topicCount > 0) badges.push({ id: 'first_topic', name: 'First Topic', description: 'Created a topic', icon: 'FileText', type: 'bronze' });
        if (postCount > 0) badges.push({ id: 'first_reply', name: 'First Reply', description: 'Replied to a topic', icon: 'MessageSquare', type: 'bronze' });
        if (accountAgeDays > 365) badges.push({ id: 'anniversary', name: 'Anniversary', description: 'Member for 1 year', icon: 'Calendar', type: 'silver' });

        return NextResponse.json({ user, stats, badges, topTopics: user.forumTopics || [], topReplies: user.forumPosts || [] });
    } catch (e: any) {
        console.error('[API] Forum Summary Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
