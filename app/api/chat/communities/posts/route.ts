import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { communityId, content, contentHtml, plainText } = body;

    // authorAddress comes from body OR from the x-web3-address header
    const authorAddress =
      body.authorAddress ||
      (req.headers as any).get?.('x-web3-address') ||
      '';

    if (!communityId || !content || !authorAddress) {
      return NextResponse.json(
        { error: 'Missing fields: communityId, content, and wallet address are required' },
        { status: 400 }
      );
    }

    const post = await prisma.communityPost.create({
      data: {
        communityId,
        authorAddress: authorAddress.toLowerCase(),
        content,
        contentHtml: contentHtml || content,
      },
    });

    return NextResponse.json({ post, status: 'PUBLISHED' });
  } catch (e: any) {
    console.error('[community-posts POST]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const communityId = searchParams.get('communityId');

  if (!communityId) {
    return NextResponse.json({ error: 'Missing communityId' }, { status: 400 });
  }

  const posts = await prisma.communityPost.findMany({
    where: { communityId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ posts });
}
