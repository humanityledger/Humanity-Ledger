import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

/**
 * Status updates ("Updates" tab in Ledger Chat).
 *
 * A status is a short text that lasts 24 hours. Who can see it:
 *   - the author;
 *   - anyone the author has saved as a contact (ChatContact owner = author,
 *     peer = viewer).
 *
 * Earlier versions returned every story to every caller, signed in or not,
 * and rejected all text statuses because they were not https URLs. Both are
 * fixed here. Statuses are stored as plain text on our server: they are not
 * end to end encrypted, and the app says so where you write one.
 */

export const dynamic = 'force-dynamic';

const MAX_TEXT = 700;
const TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const caller = await resolveVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Authors who have saved the caller as a contact.
    const audienceOf = await prisma.chatContact.findMany({
      where: { peer: { equals: caller, mode: 'insensitive' } },
      select: { owner: true },
      take: 5000,
    });
    const authors = Array.from(new Set([caller, ...audienceOf.map(c => c.owner.toLowerCase())]));

    const stories = await prisma.story.findMany({
      where: { expiresAt: { gt: new Date() }, authorAddress: { in: authors } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ stories });
  } catch {
    return NextResponse.json({ stories: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const caller = await resolveVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const mediaType = body?.mediaType === 'image' || body?.mediaType === 'video' ? body.mediaType : 'text';
  const content = typeof body?.contentUrl === 'string' ? body.contentUrl.trim() : '';

  if (mediaType === 'text') {
    if (!content || content.length > MAX_TEXT) {
      return NextResponse.json({ error: `A status is 1 to ${MAX_TEXT} characters` }, { status: 400 });
    }
  } else if (!/^https:\/\/\S+$/i.test(content) || content.length > 2048) {
    // Media must already be hosted over https. Inline data URLs are refused so
    // the database never stores large blobs.
    return NextResponse.json({ error: 'Media must be an https URL' }, { status: 400 });
  }

  try {
    // At most 30 live statuses per person.
    const live = await prisma.story.count({ where: { authorAddress: caller, expiresAt: { gt: new Date() } } });
    if (live >= 30) return NextResponse.json({ error: 'Too many active statuses' }, { status: 429 });

    const story = await prisma.story.create({
      data: { authorAddress: caller, contentUrl: content, mediaType, expiresAt: new Date(Date.now() + TTL_MS) },
    });
    return NextResponse.json({ story });
  } catch {
    return NextResponse.json({ error: 'Could not save the status' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const caller = await resolveVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const { count } = await prisma.story.deleteMany({ where: { id, authorAddress: caller } });
    return NextResponse.json({ deleted: count });
  } catch {
    return NextResponse.json({ error: 'Could not delete the status' }, { status: 500 });
  }
}
