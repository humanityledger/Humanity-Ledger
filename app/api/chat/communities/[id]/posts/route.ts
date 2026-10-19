import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

export const dynamic = 'force-dynamic';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: communityId } = await params;
    // Posts tab = rich community posts (with a title)
    const posts = await (prisma as any).communityPost.findMany({
      where: {
        communityId,
        title: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ posts });
  } catch (e: any) {
    console.error('[community/[id]/posts GET]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let caller = await resolveVerifiedCaller(req);
    if (!caller) {
      const headerAddr = req.headers.get('x-web3-address') || req.headers.get('x-verified-session-address');
      if (headerAddr && ETH_ADDR_REGEX.test(headerAddr)) {
        caller = headerAddr.toLowerCase();
      }
    }
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: communityId } = await params;
    const community = await (prisma as any).community.findUnique({
      where: { id: communityId },
      include: { permissions: true }
    });
    if (!community) return NextResponse.json({ error: 'Community not found' }, { status: 404 });

    const isOwner = community.ownerAddress?.toLowerCase() === caller.toLowerCase();
    let membership = await (prisma as any).communityMember.findFirst({
      where: { communityId, walletAddress: caller.toLowerCase() }
    });

    if (!membership && isOwner) {
      membership = await (prisma as any).communityMember.create({
        data: {
          communityId,
          walletAddress: caller.toLowerCase(),
          role: 'ADMIN'
        }
      }).catch(() => null);
    } else if (!membership && !community.isPrivate) {
      membership = await (prisma as any).communityMember.create({
        data: {
          communityId,
          walletAddress: caller.toLowerCase(),
          role: 'MEMBER'
        }
      }).catch(() => null);
    }

    if (!membership && !isOwner) {
      return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 });
    }

    const body = await req.json();
    const { title, content, contentHtml, channelId } = body;
    if (!content?.trim() && !contentHtml?.trim()) {
      return NextResponse.json({ error: 'Empty content' }, { status: 400 });
    }

    const postTitle = (title && typeof title === 'string' && title.trim().length > 0)
      ? title.trim()
      : 'Community Post';

    const post = await (prisma as any).communityPost.create({
      data: {
        communityId,
        channelId: channelId || null,
        authorAddress: caller.toLowerCase(),
        title: postTitle,
        content: content || contentHtml || '',
        contentHtml: contentHtml || content || '',
      }
    });

    return NextResponse.json({ post, success: true });
  } catch (e: any) {
    console.error('[community/[id]/posts POST]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

