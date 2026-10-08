import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function resolveCaller(req: NextRequest) {
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  return null; // Spoofing vector closed
}

// GET /api/chat/updates
// Fetch my updates AND updates from my contacts
export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Ensure table exists safely via raw SQL (since Prisma client might not have it yet)
    await prisma.$executeRawUnsafe(`
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
    `).catch(() => {});

    // Find all my contacts
    const contacts = await (prisma as any).chatContact.findMany({
      where: { owner: caller },
      select: { peer: true }
    });
    const contactAddresses = contacts.map((c: any) => c.peer);
    
    // Get active updates (not expired) using raw SQL
    // to match logic without needing generated client
    let peersList = contactAddresses.length > 0 
        ? contactAddresses.map((p: string) => `'${p.replace(/'/g, "''")}'`).join(',') 
        : "'0xnobody'";

    const callerSafe = caller.replace(/'/g, "''");

    const updates = await prisma.statusUpdate.findMany({ where: { expiresAt: { gt: new Date() }, OR: [ { ownerAddress: caller }, { ownerAddress: { in: contactAddresses || [] }, privacy: { in: ["everyone", "contacts"] } }, { privacy: "everyone" } ] }, orderBy: { createdAt: "desc" }, take: 50 });

    return NextResponse.json({ updates });
  } catch (error: any) {
    console.error('[Updates API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/chat/updates
// Create a new status update
export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { text, emoji, privacy } = await req.json();
    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });

    // Ensure table exists
    await prisma.$executeRawUnsafe(`
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
    `).catch(() => {});

    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();
    
    const textSafe = text.replace(/'/g, "''");
    const privacySafe = (privacy || 'contacts').replace(/'/g, "''");
    const callerSafe = caller.replace(/'/g, "''");

    await prisma.$executeRawUnsafe(`
      INSERT INTO "StatusUpdate" ("id", "ownerAddress", "text", "privacy", "expiresAt", "createdAt")
      VALUES ('${id}', '${callerSafe}', '${textSafe}', '${privacySafe}', '${expiresAt}', '${createdAt}')
    `);

    const update = {
      id,
      ownerAddress: caller,
      text,
      privacy: privacy || 'contacts',
      expiresAt,
      createdAt
    };

    return NextResponse.json({ update });
  } catch (error: any) {
    console.error('[Updates POST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
