import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { activityByDay, memberGrowthByMonth } from '@/lib/communities/analytics';
import { zkVerifiedWallets } from '@/lib/communities/identity';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: communityId } = await params;
    if (!communityId) {
      return NextResponse.json({ error: 'Missing community id' }, { status: 400 });
    }

    // Resolve caller securely from session
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const caller = auth.walletAddress;

    const community = await (prisma as any).community.findUnique({
      where: { id: communityId },
      include: {
        members: {
          orderBy: { joinedAt: 'asc' },
        },
        channels: {
          orderBy: { position: 'asc' },
        },
        _count: {
          select: { members: true, channels: true },
        },
      },
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    // Check membership and admin authorization
    const isOwner = community.ownerAddress?.toLowerCase() === caller;
    const member = community.members?.find((m: any) => m.walletAddress?.toLowerCase() === caller);
    const isAdmin = isOwner || member?.role === 'ADMIN' || member?.role === 'OWNER';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required for analytics' }, { status: 403 });
    }

    // 1. Native Member Count & Admin Breakdown
    const totalMembers = community.members?.length ?? community._count.members;
    const adminCount = (community.members ?? []).filter((m: any) => m.role === 'ADMIN' || m.role === 'OWNER').length;

    // 2. Native Channel Breakdown
    const totalChannels = community.channels?.length ?? community._count.channels;

    // 3. Posts (title set) and channel chat messages (title null) are both CommunityPost rows.
    // A failed count is reported as null ("not available"), never as 0: an outage must not read
    // as "no activity".
    const since30d = new Date(Date.now() - 30 * 86_400_000);
    const countOrNull = (where: Record<string, unknown>): Promise<number | null> =>
      (prisma as any).communityPost.count({ where }).then((n: number) => n).catch(() => null);
    const [totalPosts, totalChannelMessages, channelMessages30d] = await Promise.all([
      countOrNull({ communityId, NOT: { title: null } }),
      countOrNull({ communityId, title: null }),
      countOrNull({ communityId, title: null, createdAt: { gte: since30d } }),
    ]);

    const recentPosts = await (prisma as any).communityPost.findMany({
      where: { communityId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        authorAddress: true,
        likes: true,
        createdAt: true,
      },
    }).catch(() => []);

    // 4. Member growth, grouped by calendar month AND year (UTC). A key of the month name alone
    // merged e.g. November 2025 into November 2026. Keys are YYYY-MM so they sort chronologically.
    const sortedMembers = [...(community.members || [])].sort(
      (a: any, b: any) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    );
    const growthData = memberGrowthByMonth(sortedMembers.map((m: any) => m.joinedAt));

    // 5. Native Recent Activities
    const recentActivities: any[] = [];

    recentPosts.forEach((post: any) => {
      const author = `${post.authorAddress.slice(0, 6)}…${post.authorAddress.slice(-4)}`;
      recentActivities.push({
        id: `post-${post.id}`,
        action: post.title ? 'Post published' : 'Channel message',
        details: post.title ? `"${post.title}" by ${author}` : `by ${author}`,
        time: new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
      });
    });

    // Creation last: the list is newest first
    recentActivities.push({
      id: `milestone-created`,
      action: 'Community created',
      details: community.name,
      time: new Date(community.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
    });

    // 6. Native Real Members
    const verified = await zkVerifiedWallets([community.ownerAddress, ...sortedMembers.map((m: any) => m.walletAddress)]);
    const realMembers = sortedMembers.map((m: any) => ({
      address: m.walletAddress,
      role: m.role || 'MEMBER',
      joinedAt: m.joinedAt,
      isZkVerified: verified.has(String(m.walletAddress || '').toLowerCase()),
    }));

    // 7. V2 figures. An encrypted (MLS) community's posts are not on this server: activity is null
    // here and the admin's device computes it from the channels it can decrypt.
    const isMls = community.communityMls === true;
    const roleBreakdown = { OWNER: 1, ADMIN: 0, MODERATOR: 0, MEMBER: 0 };
    const owner = String(community.ownerAddress || '').toLowerCase();
    for (const m of sortedMembers) {
      if (String(m.walletAddress || '').toLowerCase() === owner) continue;
      const r = m.role === 'ADMIN' || m.role === 'MODERATOR' ? m.role : 'MEMBER';
      roleBreakdown[r as 'ADMIN' | 'MODERATOR' | 'MEMBER']++;
    }
    let dailyActivity14d: ReturnType<typeof activityByDay> | null = null;
    let channelPostCounts: Record<string, number> | null = null;
    if (!isMls) {
      const since14 = new Date(Date.now() - 14 * 86_400_000);
      const rows: Array<{ createdAt: Date; channelId: string | null }> | null = await (prisma as any).communityPost.findMany({
        where: { communityId, createdAt: { gte: since14 } },
        select: { createdAt: true, channelId: true },
        take: 20_000,
      }).catch(() => null);
      if (rows) dailyActivity14d = activityByDay(rows.map((r) => r.createdAt), 14);
      const grouped: Array<{ channelId: string | null; _count: { _all: number } }> | null = await (prisma as any).communityPost.groupBy({
        by: ['channelId'], where: { communityId }, _count: { _all: true },
      }).catch(() => null);
      if (grouped) {
        const first = community.channels?.[0]?.id ?? null;
        channelPostCounts = {};
        for (const ch of community.channels || []) channelPostCounts[ch.id] = 0;
        for (const g of grouped) {
          const key = g.channelId ?? first;
          if (key) channelPostCounts[key] = (channelPostCounts[key] ?? 0) + g._count._all;
        }
      }
    }
    const activeProposalsCount = await (prisma as any).marketProposal.count({
      where: { OR: [{ category: `COMMUNITY_${communityId}` }, { category: communityId }], votingEndsAt: { gt: new Date() } },
    }).catch(() => null);

    return NextResponse.json({
      community: {
        id: community.id,
        name: community.name,
        description: community.description,
        isPrivate: community.isPrivate,
        ownerAddress: community.ownerAddress,
        createdAt: community.createdAt,
        joinCode: community.joinCode,
        communityMls: isMls,
      },
      dailyActivity14d,
      roleBreakdown,
      activeProposalsCount,
      verifiedMembersCount: verified.size,
      channelPostCounts,
      stats: {
        totalMembers,
        adminCount,
        totalChannels,
        totalPosts,
        totalChannelMessages,
        channelMessages30d,
        myRole: sortedMembers.find((m: any) => m.walletAddress?.toLowerCase() === caller)?.role || (community.ownerAddress.toLowerCase() === caller ? 'OWNER' : 'MEMBER'),
      },
      growthData,
      recentActivities,
      members: realMembers,
      channels: community.channels || [],
    });
  } catch (error: any) {
    console.error('[Community Analytics GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
