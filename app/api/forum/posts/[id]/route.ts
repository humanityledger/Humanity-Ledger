import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSecureRequest } from '@/lib/security/premium-security';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const validation = await validateSecureRequest(req);
    if (!validation.valid || !validation.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: postId } = await params;

    // Resolve the user
    const user = await prisma.user.findUnique({
      where: { walletAddress: validation.userId! },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Fetch the post and verify ownership
    const post = await (prisma as any).forumPost.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.authorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden  not the author' }, { status: 403 });
    }

    // Delete likes on the post first (FK constraint)
    await (prisma as any).forumLike.deleteMany({ where: { postId } });

    // Delete the post
    await (prisma as any).forumPost.delete({ where: { id: postId } });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
