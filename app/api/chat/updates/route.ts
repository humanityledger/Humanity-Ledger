import { NextRequest, NextResponse } from 'next/server';
import { prisma, prismaRead } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { safeRedisGet, safeRedisSet, safeRedisDel } from '@/lib/redis/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const ALLOWED_PRIVACY = new Set(['everyone', 'contacts', 'nobody']);
const UPDATES_FEED_TTL_S = 15;
const UPDATES_CONTACTS_TTL_S = 30;
const inFlightUpdatesFeed = new Map<string, Promise<any[]>>();

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = caller.toLowerCase();
    const feedKey = `updates:feed:v1:${me}`;

    const cachedFeed = await safeRedisGet(feedKey);
    if (cachedFeed && cachedFeed !== 'TIMEOUT') {
      try {
        const updates = JSON.parse(cachedFeed);
        if (Array.isArray(updates)) return NextResponse.json({ updates });
      } catch {}
    }

    let pending = inFlightUpdatesFeed.get(me);
    if (!pending) {
      pending = (async () => {
        try {
          const dbRead = prismaRead ?? prisma;
          const contactsKey = `updates:contacts:v1:${me}`;
          let contactAddresses: string[] | null = null;
          const cachedContacts = await safeRedisGet(contactsKey);
          if (cachedContacts && cachedContacts !== 'TIMEOUT') {
            try {
              const parsed = JSON.parse(cachedContacts);
              if (Array.isArray(parsed)) contactAddresses = parsed;
            } catch {}
          }
          if (!contactAddresses) {
            const contacts = await dbRead.chatContact.findMany({
              where: { owner: me },
              select: { peer: true },
              take: 1000,
            });
            contactAddresses = contacts.map((c: { peer: string }) => c.peer.toLowerCase());
            await safeRedisSet(contactsKey, JSON.stringify(contactAddresses), 'EX', UPDATES_CONTACTS_TTL_S);
          }

          const now = new Date();
          const updates = await dbRead.statusUpdate.findMany({
            where: {
              expiresAt: { gt: now },
              OR: [
                { ownerAddress: me },
                ...(contactAddresses.length ? [{ ownerAddress: { in: contactAddresses }, privacy: { in: ['everyone', 'contacts'] } }] : []),
                { privacy: 'everyone' },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          });
          await safeRedisSet(feedKey, JSON.stringify(updates), 'EX', UPDATES_FEED_TTL_S);
          return updates;
        } finally {
          inFlightUpdatesFeed.delete(me);
        }
      })();
      inFlightUpdatesFeed.set(me, pending);
    }

    const updates = await pending;
    return NextResponse.json({ updates });
  } catch (error: any) {
    console.error('[Updates API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function resolveCaller(req: NextRequest) {
  return getVerifiedCaller(req);
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = caller.toLowerCase();

    const { text, emoji, privacy } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }
    if (text.length > 500) {
      return NextResponse.json({ error: 'Status text too long (max 500 chars)' }, { status: 400 });
    }

    const privacySanitized = ALLOWED_PRIVACY.has(privacy) ? privacy : 'contacts';
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const now = new Date();

    const created = await prisma.statusUpdate.create({
      data: {
        id,
        ownerAddress: me,
        text: text.trim(),
        emoji: typeof emoji === 'string' && emoji.length <= 16 ? emoji : null,
        privacy: privacySanitized,
        expiresAt,
        createdAt: now,
      },
    });
    await safeRedisDel(`updates:feed:v1:${me}`);

    return NextResponse.json({
      update: {
        id: created.id,
        ownerAddress: created.ownerAddress,
        text: created.text,
        emoji: created.emoji,
        privacy: created.privacy,
        expiresAt: created.expiresAt.toISOString(),
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Updates POST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
