import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';
import crypto from 'crypto';
import { audienceAllows, normalizeAudience, parseStatusMedia, statusKindOf } from '@/lib/chat/status-media';

/**
 * Status updates ("Updates" tab in Ledger Chat).
 *
 * A status is a short text, a photo or a short video that lasts 24 hours. It is shown to the
 * author and to people who saved the author as a contact, narrowed by `audience` when the author
 * picked some contacts. Media must be one of our encrypted attachments (lib/chat/status-media.ts);
 * the key is in the record, so the server can read Status: it is not end-to-end encrypted.
 * Supported both via PostgreSQL (when present) and resilient in-memory store
 * so statuses work flawlessly in zero-database / standalone environments.
 */

export const dynamic = 'force-dynamic';

const MAX_TEXT = 700;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE = 30;

interface MemoryStory {
  id: string;
  authorAddress: string;
  contentUrl: string;
  mediaType: string;
  audience: string[];
  createdAt: string;
  expiresAt: string;
}

// In-memory stories registry for zero-config standalone production
const inMemoryStories: MemoryStory[] = [];

export async function GET(req: NextRequest) {
  const caller = await resolveVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const me = caller.toLowerCase();
  let dbStories: any[] = [];
  // Authors the caller may see: the caller and everyone who saved the caller as a contact.
  // Without the database only the caller's own statuses are visible (the in-memory store used to
  // return every author's statuses to any signed-in wallet).
  let authors = new Set<string>([me]);

  try {
    const audienceOf = await prisma.chatContact.findMany({
      where: { peer: { equals: caller, mode: 'insensitive' } },
      select: { owner: true },
      take: 5000,
    }).catch(() => []);

    authors = new Set([me, ...audienceOf.map(c => c.owner.toLowerCase())]);

    dbStories = await prisma.story.findMany({
      where: { expiresAt: { gt: now }, authorAddress: { in: Array.from(authors) } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }).catch(() => []);
  } catch {}

  // Active in-memory stories (within 24h), from the same authors only.
  const validMemStories = inMemoryStories.filter(s => new Date(s.expiresAt) > now && authors.has(s.authorAddress));

  // Merge and deduplicate
  const seen = new Set<string>();
  const combined: any[] = [];

  for (const s of [...dbStories, ...validMemStories]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const author = String(s.authorAddress).toLowerCase();
    const audience: string[] = Array.isArray(s.audience) ? s.audience : [];
    if (!audienceAllows(author, audience, me)) continue;
    // The author sees how many people were picked; nobody else learns who else was picked.
    const { audience: _hidden, ...rest } = s;
    combined.push(author === me ? { ...rest, audienceSize: audience.length } : rest);
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
  const audience = normalizeAudience(body?.audience);

  if (mediaType === 'text') {
    if (!content || content.length > MAX_TEXT) {
      return NextResponse.json({ error: `A status is 1 to ${MAX_TEXT} characters` }, { status: 400 });
    }
  } else {
    // Only our own encrypted attachments: a Status never points viewers at a third-party host.
    const media = parseStatusMedia(content);
    if (!media || statusKindOf(media) !== mediaType) {
      return NextResponse.json({ error: 'Media must be an encrypted Ledger Chat attachment' }, { status: 400 });
    }
  }

  const me = caller.toLowerCase();
  const active = inMemoryStories.filter(s => s.authorAddress === me && new Date(s.expiresAt).getTime() > Date.now()).length;
  const activeDb = await prisma.story.count({ where: { authorAddress: me, expiresAt: { gt: new Date() } } }).catch(() => 0);
  if (Math.max(active, activeDb) >= MAX_ACTIVE) {
    return NextResponse.json({ error: 'Too many active statuses' }, { status: 429 });
  }

  const now = Date.now();
  const id = crypto.randomUUID ? crypto.randomUUID() : `story_${now}_${Math.random().toString(36).slice(2, 9)}`;

  const newStory: MemoryStory = {
    id,
    authorAddress: caller.toLowerCase(),
    contentUrl: content,
    mediaType,
    audience,
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
        audience,
        expiresAt: new Date(now + TTL_MS),
      },
    });
    const { audience: a, ...rest } = dbStory as typeof dbStory & { audience: string[] };
    return NextResponse.json({ story: { ...rest, audienceSize: a.length } }, { status: 200 });
  } catch {
    // Zero-config standalone mode: return in-memory story with HTTP 200
    const { audience: a, ...rest } = newStory;
    return NextResponse.json({ story: { ...rest, audienceSize: a.length } }, { status: 200 });
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
    // A photo or video kept in Postgres goes with its status.
    const story = await prisma.story.findFirst({ where: { id, authorAddress: caller.toLowerCase() }, select: { contentUrl: true } }).catch(() => null);
    const mediaId = story ? /\/api\/chat\/stories\/media\/([0-9a-f]{32})(?:#|$)/.exec(story.contentUrl)?.[1] : undefined;
    if (mediaId) await prisma.statusMedia.deleteMany({ where: { id: mediaId, authorAddress: caller.toLowerCase() } }).catch(() => {});
    const { count } = await prisma.story.deleteMany({ where: { id, authorAddress: caller.toLowerCase() } });
    return NextResponse.json({ deleted: count || (idx !== -1 ? 1 : 0) });
  } catch {
    return NextResponse.json({ deleted: idx !== -1 ? 1 : 0 }, { status: 200 });
  }
}
