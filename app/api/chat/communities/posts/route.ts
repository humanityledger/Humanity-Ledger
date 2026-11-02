import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await requireWallet(req as any);
    if (auth.errorResponse) return auth.errorResponse;
    const authorAddress = auth.walletAddress;

    const body = await req.json();
    const { communityId, channelId, title, content, contentHtml } = body;

    if (!communityId || !content) {
      return NextResponse.json(
        { error: 'Missing fields: communityId and content are required' },
        { status: 400 }
      );
    }

    // Enforce Membership and Permissions
    const community = await (prisma as any).community.findUnique({
      where: { id: communityId },
      include: { permissions: true }
    });
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const isOwner = community.ownerAddress?.toLowerCase() === authorAddress;
    let membership = await (prisma as any).communityMember.findFirst({
      where: { communityId, walletAddress: authorAddress },
    });

    if (!membership && isOwner) {
      membership = await (prisma as any).communityMember.create({
        data: { communityId, walletAddress: authorAddress, role: 'ADMIN' }
      }).catch(() => null);
    } else if (!membership && !community.isPrivate) {
      membership = await (prisma as any).communityMember.create({
        data: { communityId, walletAddress: authorAddress, role: 'MEMBER' }
      }).catch(() => null);
    }

    if (!membership && !isOwner) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    if (membership && membership.role !== 'ADMIN' && !isOwner) {
      const perms = community.permissions;
      if (perms && perms.sendMessages === false) {
        return NextResponse.json({ error: 'This community is currently locked for members' }, { status: 403 });
      }
    }

    // Limits that did not exist: size, speed, and a channel that belongs to
    // this community.
    if (typeof content !== 'string' || content.length > 20_000 || (contentHtml && (typeof contentHtml !== 'string' || contentHtml.length > 40_000))) {
      return NextResponse.json({ error: 'The message is too long.' }, { status: 413 });
    }
    if (title !== undefined && title !== null && (typeof title !== 'string' || title.length > 140)) {
      return NextResponse.json({ error: 'Invalid title.' }, { status: 400 });
    }
    const rl = await checkRateLimit(authorAddress, { max: 60, windowSec: 60, prefix: 'rl:community-msg' });
    if (!rl.allowed) return NextResponse.json({ error: 'You are sending messages too fast. Wait a moment.' }, { status: 429 });
    if (channelId !== undefined && channelId !== null) {
      const ch = typeof channelId === 'string'
        ? await (prisma as any).communityChannel.findFirst({ where: { id: channelId, communityId }, select: { id: true } })
        : null;
      if (!ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }
    const post = await prisma.communityPost.create({
      data: {
        communityId,
        channelId,
        authorAddress: authorAddress.toLowerCase(),
        title,
        content,
        contentHtml: contentHtml || content,
      },
    });

    return NextResponse.json({ post, status: 'PUBLISHED' });
  } catch (e: any) {
    console.error('[community-posts POST]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const communityId = searchParams.get('communityId');
    const channelId = searchParams.get('channelId');
    const before = searchParams.get('before');
    const since = searchParams.get('since');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 50;

    if (!communityId) {
      return NextResponse.json({ error: 'Missing communityId' }, { status: 400 });
    }

    const community = await (prisma as any).community.findUnique({
      where: { id: communityId },
      select: { id: true, isPrivate: true, ownerAddress: true }
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    // A-023: Check membership in private communities
    if (community.isPrivate) {
      const auth = await requireWallet(req as any);
      if (auth.errorResponse) return auth.errorResponse;
      const caller = auth.walletAddress;

      const isOwner = community.ownerAddress?.toLowerCase() === caller;
      const membership = await (prisma as any).communityMember.findFirst({
        where: { communityId, walletAddress: caller }
      });

      if (!membership && !isOwner) {
        return NextResponse.json({ error: 'Forbidden: Membership required for private community' }, { status: 403 });
      }
    }

    // A-024: orderBy desc, take 50, and cursor before/since
    const whereClause: any = {
      communityId,
      title: null,
      ...(channelId ? { channelId } : {}),
    };

    if (before) {
      whereClause.createdAt = { ...(whereClause.createdAt || {}), lt: new Date(before) };
    }
    if (since) {
      whereClause.createdAt = { ...(whereClause.createdAt || {}), gt: new Date(since) };
    }

    const posts = await prisma.communityPost.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ posts });
  } catch (e: any) {
    console.error('[community-posts GET]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
