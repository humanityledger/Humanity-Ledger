import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/admin';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/clean-posts
 * Deletes ALL topics EXCEPT the one with the word "Welcome" in the title
 * (case-insensitive). The welcome post is always preserved.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    const address = session?.userId;
    if (!address || !isAdmin(address)) {
        return NextResponse.json({ error: 'Unauthorized: System Admin Only' }, { status: 403 });
    }
    // Find all topics
    const allTopics = await (prisma as any).forumTopic.findMany({
      select: { id: true, title: true },
    });

    // Partition: keep topics whose title contains "welcome" or "bienvenid"
    const keepIds = allTopics
      .filter((t: any) =>
        /welcome|bienvenid|humanityledger|announcement|inaugural/i.test(t.title)
      )
      .map((t: any) => t.id);

    const deleteIds = allTopics
      .filter((t: any) => !keepIds.includes(t.id))
      .map((t: any) => t.id);

    // Helper to safely chunk arrays for Postgres IN queries
    const chunkArray = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
      );

    if (deleteIds.length === 0) {
      return NextResponse.json({ message: 'Nothing to delete  only welcome posts found.', kept: keepIds.length });
    }

    // Cascade-delete everything for each topic being deleted using chunks
    const deleteIdChunks = chunkArray(deleteIds, 5000);
    
    for (const dChunk of deleteIdChunks) {
      const postsToDelete = await (prisma as any).forumPost.findMany({
        where: { topicId: { in: dChunk } },
        select: { id: true },
      });
      const postIds = postsToDelete.map((p: any) => p.id);
      const postIdChunks = chunkArray(postIds, 5000);

      // 1. Likes on posts
      for (const pChunk of postIdChunks) {
        await (prisma as any).forumLike.deleteMany({ where: { postId: { in: pChunk } } });
      }
      
      // 2. Posts themselves
      await (prisma as any).forumPost.deleteMany({ where: { topicId: { in: dChunk } } });
      
      // 3. Likes on topics
      await (prisma as any).forumLike.deleteMany({ where: { topicId: { in: dChunk } } });
      
      // 4. Notifications (best-effort)
      try { await (prisma as any).forumNotification.deleteMany({ where: { topicId: { in: dChunk } } }); } catch {}
      
      // 5. Topics
      await (prisma as any).forumTopic.deleteMany({ where: { id: { in: dChunk } } });
    }

    return NextResponse.json({
      success: true,
      deleted: deleteIds.length,
      preserved: keepIds.length,
      preservedTitles: allTopics.filter((t: any) => keepIds.includes(t.id)).map((t: any) => t.title),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
