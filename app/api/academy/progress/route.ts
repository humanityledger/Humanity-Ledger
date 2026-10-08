import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/academy/progress?address=0x...
 * Returns { progress: [...], submissions: [...] }
 */
export async function GET(request: NextRequest) {
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ progress: [], submissions: [] }, { status: 401 });
    }
    const address = session.userId;
    try {
        const user = await (prisma.user.findUnique as any)({
            where:   { walletAddress: address },
            include: { progress: true, submissions: true },
        });
        return NextResponse.json({
            progress:    user?.progress    ?? [],
            submissions: user?.submissions ?? [],
        });
    } catch (e: any) {
        console.error('[Academy Progress GET]', e);
        return NextResponse.json({ progress: [], submissions: [] });
    }
}

/**
 * POST /api/academy/progress
 * Body: { address, lessonId, completed }
 */
export async function POST(request: NextRequest) {
    try {
        // [SECURITY HARDENING] Derive address from cryptographic session,
        // NOT from request body. Previously any caller could forge lesson completions
        // for arbitrary wallet addresses (IDOR + Data Integrity Attack).
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        const address = session.userId; // Cryptographically verified
        const { lessonId, completed } = await request.json();
        if (!lessonId) {
            return NextResponse.json({ ok: false, error: 'lessonId required' }, { status: 400 });
        }

        const user = await prisma.user.upsert({
            where:  { walletAddress: address },
            update: {},
            create: { walletAddress: address },
        });

        if (completed) {
            await prisma.userProgress.upsert({
                where:  { userId_lessonId: { userId: user.id, lessonId } },
                update: { completed: true, timestamp: new Date() },
                create: { userId: user.id, lessonId, completed: true },
            });
        } else {
            await prisma.userProgress.deleteMany({
                where: { userId: user.id, lessonId },
            });
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('[Academy Progress POST]', e);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
