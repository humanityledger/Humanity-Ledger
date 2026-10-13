import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

export const dynamic = 'force-dynamic';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function POST(req: Request) {
  try {
    let caller = await resolveVerifiedCaller(req as any);
    if (!caller) {
      const headerAddr = (req as any).headers?.get?.('x-web3-address') || (req as any).headers?.get?.('x-verified-session-address');
      if (headerAddr && ETH_ADDR_REGEX.test(headerAddr)) {
        caller = headerAddr.toLowerCase();
      }
    }
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { communityId, channelId, title, content, contentHtml } = body;
    const authorAddress = caller.toLowerCase();

    if (!communityId || !content) {
      return NextResponse.json(
        { error: 'Missing fields: communityId and content are required' },
        { status: 400 }
      );
    }

    // Enforce Membership and Permissions
    const membership = await (prisma as any).communityMember.findFirst({
      where: { communityId, walletAddress: authorAddress },
      include: { community: { include: { permissions: true } } }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    if (membership && membership.role !== 'ADMIN') {
      const perms = membership.community.permissions;
      if (perms && perms.sendMessages === false) {
        return NextResponse.json({ error: 'This community is currently locked for members' }, { status: 403 });
      }
    }

    const post = await prisma.communityPost.create({
      data: {
        communityId,
        channelId, // Now explicitly saved in DB
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
  const { searchParams } = new URL(req.url);
  const communityId = searchParams.get('communityId');
  const channelId = searchParams.get('channelId');

  if (!communityId) {
    return NextResponse.json({ error: 'Missing communityId' }, { status: 400 });
  }

  // Chat messages = entries WITHOUT a title.
  // Entries WITH a title are rich posts served by /api/chat/communities/[id]/posts.
  const posts = await prisma.communityPost.findMany({
    where: {
      communityId,
      title: null,
      ...(channelId ? { channelId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  return NextResponse.json({ posts });
}

