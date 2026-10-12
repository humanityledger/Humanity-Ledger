import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const stories = await prisma.story.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ stories });
  } catch (error) {
    return NextResponse.json({ stories: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const address = await resolveVerifiedCaller(req);
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { contentUrl, mediaType } = await req.json();
    if (!contentUrl || typeof contentUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid contentUrl' }, { status: 400 });
    }
    // Prevent SSRF — only allow https:// URLs
    if (!contentUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'contentUrl must use HTTPS' }, { status: 400 });
    }

    const story = await prisma.story.create({
      data: {
        authorAddress: address.toLowerCase(),
        contentUrl,
        mediaType: mediaType || 'image',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });
    return NextResponse.json({ story });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
