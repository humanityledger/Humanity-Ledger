import { NextRequest, NextResponse } from 'next/server';
import { prisma, prismaRead } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { canonicalUsername, usernameProblem } from '@/lib/chat/usernames';
import { safeRedisGet, safeRedisSet } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const SEARCH_CACHE_TTL_S = 30;

function prefixVariants(q: string): string[] {
  const lower = q.toLowerCase();
  const cap = lower.charAt(0).toUpperCase() + lower.slice(1);
  return Array.from(new Set([q, lower, cap])).filter(Boolean);
}

/**
 * GET /api/chat/users/search?q=@nickname_or_0xaddress
 * Index-backed user search (exact wallet/username + B-Tree prefix matching) with Redis cache.
 * Never performs leading-wildcard ILIKE '%q%' sequential scans.
 */
export async function GET(req: NextRequest) {
  const caller = await getVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = await checkRateLimit(caller, { max: 60, windowSec: 60, prefix: 'rl:user-search' });
  if (!rl.allowed) return NextResponse.json({ users: [], error: 'Too many searches' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('q')?.trim() ?? '';
  const q = raw.startsWith('@') ? raw.slice(1) : raw;

  if (!q || q.length > 64 || (!raw.startsWith('0x') && q.length < 2)) {
    return NextResponse.json({ users: [] });
  }

  const dbRead = prismaRead ?? prisma;
  const cacheKey = `search:users:v2:${raw.toLowerCase()}`;
  const cached = await safeRedisGet(cacheKey);
  if (cached && cached !== 'TIMEOUT') {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed?.users)) return NextResponse.json(parsed);
    } catch {}
  }

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
    const rows = await (dbRead as any).chatUsername.findMany({ where: { walletAddress: { in: addresses.map((a) => a.toLowerCase()) } } });
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
      const user = await (dbRead as any).user.findUnique({
        where: { walletAddress: raw.toLowerCase() },
        select: SELECT,
      });
      if (user) await loadUsernames([user.walletAddress]);
      const payload = { users: user ? [formatUser(user, true)] : [] };
      await safeRedisSet(cacheKey, JSON.stringify(payload), 'EX', SEARCH_CACHE_TTL_S);
      return NextResponse.json(payload);
    }

    // Hex address prefix lookup (uses User.walletAddress unique B-Tree index)
    if (raw.startsWith('0x') && /^0x[0-9a-fA-F]{2,39}$/.test(raw)) {
      const hexPrefix = raw.toLowerCase();
      const users = await (dbRead as any).user.findMany({
        where: { walletAddress: { startsWith: hexPrefix } },
        select: SELECT,
        take: 20,
      });
      await loadUsernames(users.map((u: any) => u.walletAddress));
      const payload = { users: users.map((u: any) => formatUser(u)) };
      await safeRedisSet(cacheKey, JSON.stringify(payload), 'EX', SEARCH_CACHE_TTL_S);
      return NextResponse.json(payload);
    }

    // Exact canonical @username lookup first (unique B-Tree index)
    let exact: any = null;
    const canon = canonicalUsername(q);
    if (!usernameProblem(q)) {
      const hit = await (dbRead as any).chatUsername.findUnique({ where: { username: canon } });
      if (hit) {
        usernames.set(hit.walletAddress, hit.username);
        exact = (await (dbRead as any).user.findUnique({ where: { walletAddress: hit.walletAddress }, select: SELECT })) ?? {
          walletAddress: hit.walletAddress, chatName: null, displayName: null, isZkVerified: false, tier: 'FREE',
        };
      }
    }

    // Prefix match on unique usernames + B-Tree indexed prefix match on chatName/displayName
    const prefixHandles = await (dbRead as any).chatUsername.findMany({
      where: { username: { startsWith: q.toLowerCase() } },
      take: 15,
    }).catch(() => []);
    for (const h of prefixHandles) usernames.set(h.walletAddress, h.username);

    const handleAddrs = prefixHandles
      .map((h: any) => String(h.walletAddress).toLowerCase())
      .filter((a: string) => !exact || a !== String(exact.walletAddress).toLowerCase());

    const variants = prefixVariants(q);
    const orClauses: any[] = [
      ...variants.map((v) => ({ chatName: { startsWith: v } })),
      ...variants.map((v) => ({ displayName: { startsWith: v } })),
      ...(handleAddrs.length ? [{ walletAddress: { in: handleAddrs } }] : []),
    ];

    const users = await (dbRead as any).user.findMany({
      where: { OR: orClauses },
      select: SELECT,
      take: 20,
    });

    await loadUsernames(users.map((u: any) => u.walletAddress));
    const rest = users.filter((u: any) => !exact || String(u.walletAddress).toLowerCase() !== String(exact.walletAddress).toLowerCase());
    const payload = { users: [...(exact ? [formatUser(exact, true)] : []), ...rest.map((u: any) => formatUser(u))] };
    await safeRedisSet(cacheKey, JSON.stringify(payload), 'EX', SEARCH_CACHE_TTL_S);
    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('[chat/users/search]', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
