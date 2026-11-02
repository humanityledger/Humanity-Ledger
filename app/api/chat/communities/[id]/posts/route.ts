import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';

const MAX_TITLE = 140;
const MAX_BODY = 20_000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Posts of a private community are readable by its members only.
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const caller = auth.walletAddress.toLowerCase();

    const { id: communityId } = await params;
    const community = await (prisma as any).community.findUnique({ where: { id: communityId } });
    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (community.isPrivate) {
      const member = await (prisma as any).communityMember.findFirst({
        where: { communityId, walletAddress: caller },
      });
      if (!member && community.ownerAddress?.toLowerCase() !== caller) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // Posts tab = rich community posts (with a title)
    const posts = await (prisma as any).communityPost.findMany({
      where: { communityId, title: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ posts });
  } catch (e: any) {
    console.error('[community/[id]/posts GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const caller = auth.walletAddress;

    const { id: communityId } = await params;
    const community = await (prisma as any).community.findUnique({
      where: { id: communityId },
      include: { permissions: true },
    });
    if (!community) return NextResponse.json({ error: 'Community not found' }, { status: 404 });

    const isOwner = community.ownerAddress?.toLowerCase() === caller.toLowerCase();
    let membership = await (prisma as any).communityMember.findFirst({
      where: { communityId, walletAddress: caller.toLowerCase() },
    });

    if (!membership && isOwner) {
      membership = await (prisma as any).communityMember
        .create({ data: { communityId, walletAddress: caller.toLowerCase(), role: 'ADMIN' } })
        .catch(() => null);
    } else if (!membership && !community.isPrivate) {
      membership = await (prisma as any).communityMember
        .create({ data: { communityId, walletAddress: caller.toLowerCase(), role: 'MEMBER' } })
        .catch(() => null);
    }

    if (!membership && !isOwner) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { title, content, contentHtml, channelId } = body;
    const text = typeof content === 'string' ? content : '';
    const html = typeof contentHtml === 'string' ? contentHtml : '';
    if (!text.trim() && !html.trim()) {
      return NextResponse.json({ error: 'Empty content' }, { status: 400 });
    }
    if (text.length > MAX_BODY || html.length > MAX_BODY * 2) {
      return NextResponse.json({ error: 'The post is too long' }, { status: 413 });
    }

    // A channel id must belong to this community.
    let safeChannelId: string | null = null;
    if (typeof channelId === 'string' && channelId) {
      const ch = await (prisma as any).communityChannel.findFirst({ where: { id: channelId, communityId } });
      if (!ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      safeChannelId = ch.id;
    }

    const postTitle =
      typeof title === 'string' && title.trim().length > 0 ? title.trim().slice(0, MAX_TITLE) : 'Community post';

    const post = await (prisma as any).communityPost.create({
      data: {
        communityId,
        channelId: safeChannelId,
        authorAddress: caller.toLowerCase(),
        title: postTitle,
        content: text || html,
        contentHtml: html || text,
      },
    });

    return NextResponse.json({ post, success: true });
  } catch (e: any) {
    console.error('[community/[id]/posts POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
