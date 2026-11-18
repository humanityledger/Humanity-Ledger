import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { canonicalUsername, usernameProblem } from '@/lib/chat/usernames';

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

  // "@" is shown only for a real username (unique, lib/chat/usernames.ts). A display name is not
  // unique, so it is never dressed up as a handle: two people can both be called "Stefan".
  const usernames = new Map<string, string>();
  const formatUser = (u: any, exact = false) => {
    const resolvedName =
      u.chatName && u.chatName !== 'Ledger User'
        ? u.chatName
        : u.displayName ?? null;
    const handle = usernames.get(String(u.walletAddress).toLowerCase());
    return {
      address: u.walletAddress,
      nickname: handle ? `@${handle}` : '',
      username: handle ?? null,
      exact,
      name: resolvedName ?? `${String(u.walletAddress).slice(0, 6)}…${String(u.walletAddress).slice(-4)}`,
      country: '',
      isVerified: !!u.isZkVerified,
      tier: u.tier ?? 'FREE',
    };
  };
  const loadUsernames = async (addresses: string[]) => {
    if (!addresses.length) return;
    const rows = await (prisma as any).chatUsername.findMany({ where: { walletAddress: { in: addresses.map((a) => a.toLowerCase()) } } });
    for (const r of rows) usernames.set(r.walletAddress, r.username);
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
      if (user) await loadUsernames([user.walletAddress]);
      return NextResponse.json({ users: user ? [formatUser(user, true)] : [] });
    }

    // Exact username first: the one result that is certainly the person the name belongs to.
    let exact: any = null;
    if (!usernameProblem(q)) {
      const hit = await (prisma as any).chatUsername.findUnique({ where: { username: canonicalUsername(q) } });
      if (hit) {
        usernames.set(hit.walletAddress, hit.username);
        exact = (await (prisma as any).user.findUnique({ where: { walletAddress: hit.walletAddress }, select: SELECT })) ?? {
          walletAddress: hit.walletAddress, chatName: null, displayName: null, isZkVerified: false, tier: 'FREE',
        };
      }
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

    await loadUsernames(users.map((u: any) => u.walletAddress));
    const rest = users.filter((u: any) => !exact || String(u.walletAddress).toLowerCase() !== String(exact.walletAddress).toLowerCase());
    return NextResponse.json({ users: [...(exact ? [formatUser(exact, true)] : []), ...rest.map((u: any) => formatUser(u))] });
  } catch (err: any) {
    console.error('[chat/users/search]', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
