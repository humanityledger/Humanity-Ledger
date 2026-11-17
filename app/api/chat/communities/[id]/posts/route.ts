import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { getInMemoryCommunityBySlugOrId } from '@/lib/communities/in-memory-communities';
import { memberNames } from '@/lib/communities/member-names';

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

    // ── In-memory fallback: return empty posts array for seeded communities ───
    const mem = getInMemoryCommunityBySlugOrId(communityId);
    if (mem) {
      const isMember =
        mem.ownerAddress?.toLowerCase() === caller ||
        mem.members.some((m) => m.walletAddress?.toLowerCase() === caller);
      if (mem.isPrivate && !isMember) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ posts: [] });
    }

    // ── DB path ───────────────────────────────────────────────────────────────
    let community: any = null;
    try {
      community = await (prisma as any).community.findUnique({ where: { id: communityId } });
    } catch {
      return NextResponse.json({ posts: [] });
    }

    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (community.isPrivate) {
      const member = await (prisma as any).communityMember.findFirst({
        where: { communityId, walletAddress: caller },
      }).catch(() => null);
      if (!member && community.ownerAddress?.toLowerCase() !== caller) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // Posts of the reading screen = community posts (with a title).
    // ?pinned=1 returns only the posts a person pinned, newest pin first. An empty list is an
    // empty list: the client must show nothing, not the previous result.
    const pinnedOnly = ['1', 'true'].includes(req.nextUrl.searchParams.get('pinned') ?? '');
    const posts = await (prisma as any).communityPost.findMany({
      where: { communityId, title: { not: null }, ...(pinnedOnly ? { pinnedAt: { not: null } } : {}) },
      orderBy: pinnedOnly ? { pinnedAt: 'desc' } : { createdAt: 'desc' },
      take: 100,
    }).catch(() => []);
    // Each post carries its author's Ledger Chat name, so members can tell who wrote what.
    const names = await memberNames(posts.map((p: any) => p.authorAddress));
    return NextResponse.json({
      posts: posts.map((p: any) => ({ ...p, authorName: names.get(String(p.authorAddress || '').toLowerCase()) ?? null })),
    });
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

    // R-17: a community with communityMls stores posts in its XMTP group, not here.
    // Default is false, so existing communities keep this route. Nothing is written on 410.
    if (community.communityMls === true) {
      return NextResponse.json(
        { error: 'This community keeps posts in an XMTP group. The server does not store them.', code: 'COMMUNITY_MLS' },
        { status: 410 },
      );
    }

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
        // Sending never pins. Only PIN_MESSAGE sets pinnedAt.
        pinnedAt: null,
        pinnedBy: null,
      },
    });

    return NextResponse.json({ post, success: true });
  } catch (e: any) {
    console.error('[community/[id]/posts POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
