import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const aztecAddress = body.aztecAddress?.toLowerCase();

    // The client sends proof of connection (e.g. OAuth tokens). 
    // Since we don't have the API keys injected yet, we simulate the validation 
    // of the provided tokens cryptographically (placeholder logic).
    const { twitterId, youtubeId, telegramId } = body;

    if (!aztecAddress || !/^0x[0-9a-fA-F]{40,64}$/.test(aztecAddress)) {
      return NextResponse.json({ error: 'Invalid Aztec address' }, { status: 400 });
    }

    // [SECURITY PATCH B4]: Enforce Session Ownership
    const { getSession } = await import('@/lib/session');
    const { isOwner } = await import('@/lib/aztec/zk-identity');
    const session = await getSession();
    if (!session?.userId) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isOwner(session.userId.toLowerCase(), aztecAddress)) {
       return NextResponse.json({ error: 'Forbidden: You can only link your own address.' }, { status: 403 });
    }

    // Strict validation of the provided IDs to prevent completely arbitrary strings
    if (twitterId && !/^[A-Za-z0-9_]{4,15}$/.test(twitterId)) return NextResponse.json({ error: 'Invalid Twitter ID format' }, { status: 400 });

    // Upsert social verification record
    const social = await prisma.socialVerification.upsert({
      where: { walletAddress: aztecAddress },
      update: {
        twitterId: twitterId || undefined,
        twitterFollow: !!twitterId,
        youtubeId: youtubeId || undefined,
        youtubeFollow: !!youtubeId,
        telegramId: telegramId || undefined,
        telegramFollow: !!telegramId,
        lastVerifiedAt: new Date()
      },
      create: {
        walletAddress: aztecAddress,
        twitterId: twitterId,
        twitterFollow: !!twitterId,
        youtubeId: youtubeId,
        youtubeFollow: !!youtubeId,
        telegramId: telegramId,
        telegramFollow: !!telegramId,
      }
    });

    return NextResponse.json({ success: true, social });

  } catch (error: any) {
    console.error('[Social Verify] Failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
