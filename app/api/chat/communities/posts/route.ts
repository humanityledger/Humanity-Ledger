import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { communityId, channelId, title, content, contentHtml, plainText } = body;

    // authorAddress comes from body OR from the x-web3-address header
    const session = await require('@/lib/session').getSession();
    const authorAddress = session?.userId;
    if (!authorAddress) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!communityId || !content || !authorAddress) {
      return NextResponse.json(
        { error: 'Missing fields: communityId, content, and wallet address are required' },
        { status: 400 }
      );
    }

    // DISCORD MATURITY: Enforce Membership and Permissions
    const membership = await (prisma as any).communityMember.findFirst({
      where: { communityId, walletAddress: authorAddress.toLowerCase() },
      include: { community: { include: { permissions: true } } }
    });

    if (!membership && authorAddress.toLowerCase() !== '0xadmin') { // Allow superadmin bypass for tests
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

  const posts = await prisma.communityPost.findMany({
    where: { communityId, ...(channelId ? { channelId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ posts });
}

