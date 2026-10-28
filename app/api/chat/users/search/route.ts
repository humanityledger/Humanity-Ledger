import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/users/search?q=@nickname_or_0xaddress
 * Searches registered users by walletAddress, chatName, or displayName.
 * Used by LedgerChatUserSearch to show real results.
 */
export async function GET(req: NextRequest) {
  // Signed-in only (it was public), and limited: the directory could be
  // walked one letter at a time by anyone.
  const caller = await getVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = await checkRateLimit(caller, { max: 60, windowSec: 60, prefix: 'rl:user-search' });
  if (!rl.allowed) return NextResponse.json({ users: [], error: 'Too many searches' }, { status: 429 });
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('q')?.trim() ?? '';

  // Strip leading @ if present
  const q = raw.startsWith('@') ? raw.slice(1) : raw;

  if (!q || q.length > 64 || (!raw.startsWith('0x') && q.length < 2)) {
    return NextResponse.json({ users: [] });
  }

  const formatUser = (u: any) => {
    const resolvedName =
      u.chatName && u.chatName !== 'Ledger User'
        ? u.chatName
        : u.displayName ?? null;
    return {
      address: u.walletAddress,
      nickname: resolvedName
        ? `@${resolvedName}`
        : `@${(u.walletAddress ?? '').slice(2, 10)}`,
      name: resolvedName ?? 'Unknown User',
      country: '',
      isVerified: !!u.isZkVerified,
      tier: u.tier ?? 'FREE',
    };
  };

  const SELECT = {
    walletAddress: true,
    chatName: true,
    displayName: true,
    isZkVerified: true,
    tier: true,
  };

  try {
    // Exact 0x address lookup
    if (raw.startsWith('0x') && raw.length === 42) {
      const user = await (prisma as any).user.findUnique({
        where: { walletAddress: raw.toLowerCase() },
        select: SELECT,
      });
      return NextResponse.json({ users: user ? [formatUser(user)] : [] });
    }

    // Partial match on chatName, displayName, or walletAddress
    const users = await (prisma as any).user.findMany({
      where: {
        OR: [
          { chatName:     { contains: q, mode: 'insensitive' } },
          { displayName:  { contains: q, mode: 'insensitive' } },
          { walletAddress:{ contains: q, mode: 'insensitive' } },
        ],
      },
      select: SELECT,
      take: 20,
    });

    return NextResponse.json({ users: users.map(formatUser) });
  } catch (err: any) {
    console.error('[chat/users/search]', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
