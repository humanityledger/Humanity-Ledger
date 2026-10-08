import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;

        const category = await (prisma as any).forumCategory.findUnique({
            where: { slug },
            include: {
                _count: { select: { topics: true } },
                topics: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        author: { select: { walletAddress: true, tier: true, isPro: true } },
                        _count: { select: { posts: true, likes: true } },
                        tags: true
                    }
                }
            }
        });

        if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

        return NextResponse.json(category);
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
