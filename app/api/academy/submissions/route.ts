import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/academy/submissions
 * Body: { address, lessonId, txHash, proofUrl? }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        const address = session.userId;
        const rl = await checkRateLimit(address, { max: 30, windowSec: 3600, prefix: 'rl:academy-submit' });
        if (!rl.allowed) {
            return NextResponse.json({ ok: false, error: 'Too many submissions. Try again later.' }, { status: 429 });
        }
        const body = await request.json().catch(() => null);
        const lessonId = body?.lessonId;
        const txHash = body?.txHash ?? null;
        const proofUrl = body?.proofUrl ?? '';
        if (typeof lessonId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(lessonId)) {
            return NextResponse.json({ ok: false, error: 'lessonId required' }, { status: 400 });
        }
        if (txHash !== null && (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash))) {
            return NextResponse.json({ ok: false, error: 'Invalid txHash' }, { status: 400 });
        }
        if (typeof proofUrl !== 'string' || proofUrl.length > 500 || (proofUrl && !/^https:\/\/[^\s<>"']+$/i.test(proofUrl))) {
            return NextResponse.json({ ok: false, error: 'proofUrl must be an https link' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { walletAddress: address } });
        if (!user) {
            return NextResponse.json({ ok: false, error: 'User not registered' }, { status: 404 });
        }

        const submission = await (prisma as any).academySubmission.create({
            data: {
                userId:     user.id,
                lessonId,
                contentUrl: proofUrl,
                txHash,
                status:     'PENDING',
            },
        });

        return NextResponse.json({ ok: true, submission });
    } catch (e: any) {
        console.error('[Academy Submissions POST]', e);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
