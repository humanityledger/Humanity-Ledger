import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';
import crypto from 'crypto';

/**
 * Status updates ("Updates" tab in Ledger Chat).
 *
 * A status is a short text that lasts 24 hours.
 * Supported both via PostgreSQL (when present) and resilient in-memory store
 * so statuses work flawlessly in zero-database / standalone environments.
 */

export const dynamic = 'force-dynamic';

const MAX_TEXT = 700;
const TTL_MS = 24 * 60 * 60 * 1000;

interface MemoryStory {
  id: string;
  authorAddress: string;
  contentUrl: string;
  mediaType: string;
  createdAt: string;
  expiresAt: string;
}

// In-memory stories registry for zero-config standalone production
const inMemoryStories: MemoryStory[] = [];

export async function GET(req: NextRequest) {
  const caller = await resolveVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  let dbStories: any[] = [];

  try {
    const audienceOf = await prisma.chatContact.findMany({
      where: { peer: { equals: caller, mode: 'insensitive' } },
      select: { owner: true },
      take: 5000,
    }).catch(() => []);

    const authors = Array.from(new Set([caller.toLowerCase(), ...audienceOf.map(c => c.owner.toLowerCase())]));

    dbStories = await prisma.story.findMany({
      where: { expiresAt: { gt: now }, authorAddress: { in: authors } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }).catch(() => []);
  } catch {}

  // Active in-memory stories (within 24h)
  const validMemStories = inMemoryStories.filter(s => new Date(s.expiresAt) > now);

  // Merge and deduplicate
  const seen = new Set<string>();
  const combined: any[] = [];

  for (const s of [...dbStories, ...validMemStories]) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      combined.push(s);
    }
  }

  combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ stories: combined });
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
    return NextResponse.json({ error: 'Media must be an https URL' }, { status: 400 });
  }

  const now = Date.now();
  const id = crypto.randomUUID ? crypto.randomUUID() : `story_${now}_${Math.random().toString(36).slice(2, 9)}`;

  const newStory: MemoryStory = {
    id,
    authorAddress: caller.toLowerCase(),
    contentUrl: content,
    mediaType,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  };

  // Always persist to in-memory store
  inMemoryStories.unshift(newStory);
  if (inMemoryStories.length > 1000) inMemoryStories.pop();

  // Also attempt database save if configured
  try {
    const dbStory = await prisma.story.create({
      data: {
        id: newStory.id,
        authorAddress: caller.toLowerCase(),
        contentUrl: content,
        mediaType,
        expiresAt: new Date(now + TTL_MS),
      },
    });
    return NextResponse.json({ story: dbStory }, { status: 200 });
  } catch {
    // Zero-config standalone mode: return in-memory story with HTTP 200
    return NextResponse.json({ story: newStory }, { status: 200 });
  }
}

export async function DELETE(req: NextRequest) {
  const caller = await resolveVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // Remove from memory store
  const idx = inMemoryStories.findIndex(s => s.id === id && s.authorAddress === caller.toLowerCase());
  if (idx !== -1) inMemoryStories.splice(idx, 1);

  try {
    const { count } = await prisma.story.deleteMany({ where: { id, authorAddress: caller.toLowerCase() } });
    return NextResponse.json({ deleted: count || (idx !== -1 ? 1 : 0) });
  } catch {
    return NextResponse.json({ deleted: idx !== -1 ? 1 : 0 }, { status: 200 });
  }
}
