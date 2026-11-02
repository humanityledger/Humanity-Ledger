import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
    try {
        const tags = await (prisma as any).forumTag.findMany({
            include: {
                _count: { select: { topics: true } }
            },
            orderBy: {
                topics: { _count: 'desc' }
            },
            take: 100
        });

        return NextResponse.json(tags);
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
