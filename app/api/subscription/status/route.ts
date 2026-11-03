import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

// Accounts with unlimited access are configured on the server, never in the
// source: OWNER_EMAILS="a@example.com,b@example.com". Empty means none.
const OWNER_EMAILS = (process.env.OWNER_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !session.userId) {
      return NextResponse.json({
        isPremium: false,
        tier: 'FREE',
        isOwner: false,
      });
    }

    const authUserId = session.userId;
    const userEmail = session.email;

    // 1. Check if user is the owner (unlimited access)
    if (userEmail && OWNER_EMAILS.includes(String(userEmail).toLowerCase())) {
      return NextResponse.json({
        isPremium: true,
        tier: 'OWNER',
        subscriptionId: 'owner_unlimited',
        currentPeriodEnd: 4102444800, // Year 2100
        cancelAtPeriodEnd: false,
        isOwner: true,
      });
    }

    // 2. Check native System DB instead of Clerk Metadata
    const dbUser = await prisma.user.findUnique({
      where: { walletAddress: authUserId },
    });
    
    const activeSub = await prisma.subscription.findFirst({
        where: { userId: authUserId, status: 'ACTIVE' }
    });

    const isPremium = !!activeSub || dbUser?.tier === 'Private';

    return NextResponse.json({
      isPremium,
      tier: isPremium ? (activeSub?.tier || dbUser?.tier || 'PRO') : 'FREE',
      subscriptionId: activeSub?.id || null,
      currentPeriodEnd: activeSub?.expiresAt ? new Date(activeSub.expiresAt).getTime() / 1000 : null,
      cancelAtPeriodEnd: false,
      isOwner: false,
    });
  } catch (error) {
    console.error('[API ERROR] Subscription status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

