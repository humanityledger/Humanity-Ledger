import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Store identity→wallet mapping in DB for cross-device discovery
export async function POST(req: NextRequest) {
  try {
    const { identityId, walletAddress } = await req.json();
    if (!identityId || !walletAddress) {
      return NextResponse.json({ error: 'identityId and walletAddress required' }, { status: 400 });
    }
    // Upsert the user with their identityId
    await prisma.user.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: { updatedAt: new Date() },
      create: { walletAddress: walletAddress.toLowerCase() }
    });
    return NextResponse.json({ ok: true, identityId });
  } catch (e) {
    console.error('[identity]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
