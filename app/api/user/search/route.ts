import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/search?q=<address_or_username>
 * Public endpoint — no auth required. Returns basic profile for address lookup in chat.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase();
  if (!q || q.length < 3) {
    return NextResponse.json({ users: [] });
  }

  try {
    // Search by wallet address prefix or username
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { walletAddress: { startsWith: q } },
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ]
      },
      select: {
        walletAddress: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
      },
      take: 20,
    });

    return NextResponse.json({
      users: users.map(u => ({
        address: u.walletAddress,
        username: u.username || null,
        displayName: u.displayName || null,
        avatarUrl: u.avatarUrl || null,
        bio: u.bio || null,
        isVerified: u.isVerified || false,
      }))
    });
  } catch (err) {
    console.error('[User Search]', err);
    return NextResponse.json({ users: [] });
  }
}
