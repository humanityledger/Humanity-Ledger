import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const posts = await (prisma as any).communityPost.findMany({
      where: { communityId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return NextResponse.json({ posts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = req.headers.get('x-web3-address')?.toLowerCase();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify membership
    const membership = await (prisma as any).communityMember.findFirst({
      where: { communityId: params.id, walletAddress: caller }
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const body = await req.json();
    const { content, contentHtml } = body;
    if (!content?.trim()) return NextResponse.json({ error: 'Empty content' }, { status: 400 });

    const post = await (prisma as any).communityPost.create({
      data: {
        communityId: params.id,
        authorAddress: caller,
        content,
        contentHtml: contentHtml || content
      }
    });
    return NextResponse.json({ post });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
