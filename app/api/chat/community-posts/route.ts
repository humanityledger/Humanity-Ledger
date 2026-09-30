import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Auto-create the community_posts table if it doesn't exist
async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityPost" (
      "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "communityId"  TEXT NOT NULL,
      "authorAddress" TEXT NOT NULL,
      "title"        TEXT,
      "content"      TEXT NOT NULL,
      "plainText"    TEXT,
      "contentJson"  JSONB,
      "likes"        INTEGER DEFAULT 0,
      "createdAt"    TIMESTAMP DEFAULT NOW(),
      "updatedAt"    TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_community_posts_community ON "CommunityPost"("communityId");
    CREATE INDEX IF NOT EXISTS idx_community_posts_created ON "CommunityPost"("createdAt" DESC);
  `);
}

// GET /api/chat/community-posts?communityId=xxx
export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const communityId = req.nextUrl.searchParams.get('communityId');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20');
    const cursor = req.nextUrl.searchParams.get('cursor');

    if (!communityId) {
      return NextResponse.json({ error: 'Missing communityId' }, { status: 400 });
    }

    let query = `
      SELECT * FROM "CommunityPost"
      WHERE "communityId" = $1
      ${cursor ? 'AND "createdAt" < $3' : ''}
      ORDER BY "createdAt" DESC
      LIMIT $2
    `;

    const params: any[] = cursor
      ? [communityId, limit, new Date(cursor)]
      : [communityId, limit];

    const posts = await (prisma as any).$queryRawUnsafe(query, ...params);

    return NextResponse.json({
      posts,
      nextCursor: posts.length === limit ? posts[posts.length - 1]?.createdAt : null,
    });
  } catch (error: any) {
    console.error('[community-posts GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/chat/community-posts
export async function POST(req: NextRequest) {
  try {
    await ensureTable();

    const authorAddress = req.headers.get('x-web3-address');
    if (!authorAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { communityId, title, content, plainText, contentJson } = body;

    if (!communityId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing communityId or content' }, { status: 400 });
    }

    const post = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO "CommunityPost"
       ("communityId", "authorAddress", "title", "content", "plainText", "contentJson")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *`,
      communityId,
      authorAddress.toLowerCase(),
      title ?? null,
      content,
      plainText ?? null,
      contentJson ? JSON.stringify(contentJson) : null,
    );

    return NextResponse.json({ post: Array.isArray(post) ? post[0] : post }, { status: 201 });
  } catch (error: any) {
    console.error('[community-posts POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/chat/community-posts?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const id = req.nextUrl.searchParams.get('id');
    const authorAddress = req.headers.get('x-web3-address');

    if (!id || !authorAddress) {
      return NextResponse.json({ error: 'Missing id or auth' }, { status: 400 });
    }

    await (prisma as any).$executeRawUnsafe(
      `DELETE FROM "CommunityPost" WHERE "id" = $1 AND "authorAddress" = $2`,
      id,
      authorAddress.toLowerCase(),
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
