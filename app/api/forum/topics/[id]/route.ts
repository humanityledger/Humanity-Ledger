import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSecureRequest } from '@/lib/security/premium-security';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: topicId } = await params;

        // Increment views resiliently
        try {
            await (prisma as any).forumTopic.update({
                where: { id: topicId },
                data: { views: { increment: 1 } }
            });
        } catch (e: any) {
            // Silently ignore P2025 (Record to update not found) to maintain absolute log purity
            if (e.code !== 'P2025') {
                console.warn('[API] Non-critical error incrementing views:', e.message);
            }
        }

        const topic = await (prisma as any).forumTopic.findUnique({
            where: { id: topicId },
            include: {
                author: { select: { walletAddress: true, displayName: true, avatarUrl: true, bio: true, isPro: true } },
                category: { select: { name: true, color: true, slug: true } },
                tags: true,
                posts: {
                    orderBy: { createdAt: 'asc' },
                    take: 20,
                    include: {
                        author: { select: { walletAddress: true, displayName: true, avatarUrl: true, bio: true, isPro: true } },
                        likes: { select: { userId: true } }
                    }
                },
                likes: { select: { userId: true } }
            }
        });

        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        return NextResponse.json(topic);
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const validation = await validateSecureRequest(req);
        if (!validation.valid || !validation.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: topicId } = await params;

        const user = await prisma.user.findUnique({
            where: { walletAddress: validation.userId },
            select: { id: true },
        });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const topic = await (prisma as any).forumTopic.findUnique({
            where: { id: topicId },
            select: { id: true, authorId: true },
        });
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        if (topic.authorId !== user.id) {
            return NextResponse.json({ error: 'Forbidden  not the author' }, { status: 403 });
        }

        // Cascade: delete likes on posts  posts  topic likes  notifications  topic
        const posts = await (prisma as any).forumPost.findMany({
            where: { topicId },
            select: { id: true },
        });
        const postIds = posts.map((p: any) => p.id);

        await (prisma as any).forumLike.deleteMany({ where: { postId: { in: postIds } } });
        await (prisma as any).forumPost.deleteMany({ where: { topicId } });
        await (prisma as any).forumLike.deleteMany({ where: { topicId } });
        try { await (prisma as any).forumNotification.deleteMany({ where: { topicId } }); } catch {}
        await (prisma as any).forumTopic.delete({ where: { id: topicId } });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
