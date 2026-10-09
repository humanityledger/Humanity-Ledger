import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

async function resolveCaller(req: NextRequest) {
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  return null;
}

const ALLOWED_PRIVACY = new Set(['everyone', 'contacts', 'nobody']);
const DDL_CREATE_STATUS = `
  CREATE TABLE IF NOT EXISTS "StatusUpdate" (
    "id" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "emoji" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'contacts',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusUpdate_pkey" PRIMARY KEY ("id")
  );
`;

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.$executeRawUnsafe(DDL_CREATE_STATUS).catch(() => {});

    const contacts = await (prisma as any).chatContact.findMany({
      where: { owner: caller },
      select: { peer: true }
    });
    const contactAddresses: string[] = contacts.map((c: any) => c.peer as string);

    const updates = await (prisma as any).statusUpdate.findMany({
      where: {
        expiresAt: { gt: new Date() },
        OR: [
          { ownerAddress: caller },
          { ownerAddress: { in: contactAddresses }, privacy: { in: ['everyone', 'contacts'] } },
          { privacy: 'everyone' }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({ updates });
  } catch (error: any) {
    console.error('[Updates API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { text, emoji, privacy } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }
    if (text.length > 500) {
      return NextResponse.json({ error: 'Status text too long (max 500 chars)' }, { status: 400 });
    }

    const privacySanitized = ALLOWED_PRIVACY.has(privacy) ? privacy : 'contacts';

    await prisma.$executeRawUnsafe(DDL_CREATE_STATUS).catch(() => {});

    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const now = new Date();

    // [SECURITY FIX] Replaced $executeRawUnsafe + string interpolation (SQL Injection)
    // with Prisma ORM create or parameterized $executeRaw template literal.
    await prisma.$executeRaw`
      INSERT INTO "StatusUpdate" ("id", "ownerAddress", "text", "emoji", "privacy", "expiresAt", "createdAt")
      VALUES (${id}, ${caller}, ${text.trim()}, ${emoji ?? null}, ${privacySanitized}, ${expiresAt}, ${now})
    `;

    return NextResponse.json({
      update: {
        id, ownerAddress: caller,
        text: text.trim(), emoji: emoji ?? null,
        privacy: privacySanitized,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString()
      }
    });
  } catch (error: any) {
    console.error('[Updates POST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
