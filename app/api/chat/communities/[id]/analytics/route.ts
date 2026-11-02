import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

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
    const adminCount = community.members?.filter((m: any) => m.role === 'ADMIN' || m.role === 'OWNER').length ?? 1;

    // 2. Native Channel Breakdown
    const totalChannels = community.channels?.length ?? community._count.channels;

    // 3. Native Posts Count & Recent Posts
    const totalPosts = await (prisma as any).communityPost.count({
      where: { communityId },
    }).catch(() => 0);

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

    // 4. Native Member Growth Timeline (Grouped by Day/Month from actual joinedAt)
    const membersByMonth: Record<string, number> = {};
    const membersByDay: Record<string, number> = {};

    let cumulative = 0;
    const sortedMembers = [...(community.members || [])].sort(
      (a: any, b: any) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    );

    sortedMembers.forEach((m: any) => {
      const d = new Date(m.joinedAt);
      const monthKey = d.toLocaleDateString('en-US', { month: 'short' });
      const dayKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      membersByMonth[monthKey] = (membersByMonth[monthKey] || 0) + 1;
      membersByDay[dayKey] = (membersByDay[dayKey] || 0) + 1;
    });

    const growthData = Object.entries(membersByMonth).map(([month, count]) => {
      cumulative += count;
      return {
        month,
        users: cumulative,
        new: count,
        active: cumulative,
      };
    });

    // If community was just created, ensure at least one growth milestone point
    if (growthData.length === 0) {
      const monthKey = new Date(community.createdAt).toLocaleDateString('en-US', { month: 'short' });
      growthData.push({
        month: monthKey,
        users: totalMembers || 1,
        new: totalMembers || 1,
        active: totalMembers || 1,
      });
    }

    // 5. Native Recent Activities
    const recentActivities: any[] = [];

    // Milestone activity
    recentActivities.push({
      id: `milestone-created`,
      action: 'Community Created',
      details: `${community.name} sovereign space established`,
      time: new Date(community.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      iconName: 'Users',
    });

    if (totalMembers > 1) {
      recentActivities.push({
        id: `milestone-members`,
        action: 'Member Milestone',
        details: `${totalMembers} verified sovereign members joined`,
        time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        iconName: 'Activity',
      });
    }

    recentPosts.forEach((post: any) => {
      recentActivities.push({
        id: `post-${post.id}`,
        action: 'New Post Published',
        details: post.title ? `"${post.title}" by ${post.authorAddress.slice(0, 6)}...${post.authorAddress.slice(-4)}` : `Rich post by ${post.authorAddress.slice(0, 6)}...${post.authorAddress.slice(-4)}`,
        time: new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        iconName: 'FileText',
      });
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
