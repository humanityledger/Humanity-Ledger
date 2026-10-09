import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/search?q=<address_or_name>
 * Public endpoint — no auth required. Returns basic profile for address lookup in chat.
 * Uses ONLY fields that exist in the User model (schema.prisma).
 * Available profile fields: walletAddress, displayName, avatarUrl, bio, chatName, isZkVerified
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase();
  if (!q || q.length < 3) {
    return NextResponse.json({ users: [] });
  }

  try {
    // Search by wallet address prefix or displayName
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { walletAddress: { startsWith: q } },
          { displayName: { contains: q, mode: 'insensitive' } },
          { chatName: { contains: q, mode: 'insensitive' } },
        ]
      },
      select: {
        walletAddress: true,
        displayName: true,
        chatName: true,
        avatarUrl: true,
        bio: true,
        isZkVerified: true,
      },
      take: 20,
    });

    return NextResponse.json({
      users: users.map(u => ({
        address: u.walletAddress,
        displayName: u.displayName || u.chatName || null,
        avatarUrl: u.avatarUrl || null,
        bio: u.bio || null,
        isVerified: u.isZkVerified || false,
      }))
    });
  } catch (err) {
    console.error('[User Search]', err);
    return NextResponse.json({ users: [] });
  }
}
