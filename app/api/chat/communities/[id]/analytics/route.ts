import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { memberGrowthByMonth } from '@/lib/communities/analytics';

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
    const realMembers = sortedMembers.map((m: any) => ({
      address: m.walletAddress,
      role: m.role || 'MEMBER',
      joinedAt: m.joinedAt,
    }));

    return NextResponse.json({
      community: {
        id: community.id,
        name: community.name,
        description: community.description,
        isPrivate: community.isPrivate,
        ownerAddress: community.ownerAddress,
        createdAt: community.createdAt,
        joinCode: community.joinCode,
      },
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
