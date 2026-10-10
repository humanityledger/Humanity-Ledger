import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/admin';

export async function GET(req: Request) {
    try {
        const session = await getSession();
    const address = session?.userId;
        if (!isAdmin(address)) return NextResponse.json({ error: 'Unauthorized: System Admin Only' }, { status: 403 });

        const pendingTopics = await (prisma as any).forumTopic.findMany({
            take: 10,
            include: {
                author: { select: { walletAddress: true, displayName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const pendingPosts = await (prisma as any).forumPost.findMany({
            take: 10,
            include: {
                author: { select: { walletAddress: true, displayName: true } },
                topic: { select: { title: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ topics: pendingTopics, posts: pendingPosts });
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getSession();
    const address = session?.userId;
        if (!isAdmin(address)) return NextResponse.json({ error: 'Unauthorized: System Admin Only' }, { status: 403 });

        const { id, type } = await req.json(); // type: 'topic' | 'post'

        if (type === 'topic') {
            const updated = await (prisma as any).forumTopic.findUnique({
                where: { id }
            });
            return NextResponse.json(updated);
        } else if (type === 'post') {
            const updated = await (prisma as any).forumPost.findUnique({
                where: { id }
            });
            return NextResponse.json(updated);
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
