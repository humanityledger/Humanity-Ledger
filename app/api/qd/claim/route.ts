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

/**
 * POST /api/qd/claim
 * Allows a user to claim 100 QDs once per 24 hours. (Anti-sybil LC-267)
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const callerSafe = caller.replace(/'/g, "''");

    // Auto-heal table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "QDCreditLedger" (
        "id" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "delta" DOUBLE PRECISION NOT NULL,
        "direction" TEXT NOT NULL,
        "reason" TEXT NOT NULL,
        "counterparty" TEXT,
        "txRef" TEXT NOT NULL,
        "idempotencyKey" TEXT NOT NULL,
        "rail" TEXT NOT NULL DEFAULT 'internal',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "QDCreditLedger_pkey" PRIMARY KEY ("id")
      );
    `).catch(() => {});

    // Check last claim
    const lastClaims = await prisma.$queryRaw`SELECT "createdAt" FROM "QDCreditLedger" WHERE "address" =  AND "reason" = 'claim_daily' ORDER BY "createdAt" DESC LIMIT 1` as any[];

    if (lastClaims.length > 0) {
      const lastClaimTime = new Date(lastClaims[0].createdAt).getTime();
      const now = Date.now();
      if (now - lastClaimTime < 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'Daily claim limit reached. Try again tomorrow.' }, { status: 429 });
      }
    }

    const txRef = 'claim_' + Date.now();
    const dateStr = new Date().toISOString();

    // Credit receiver
    await prisma.$executeRawUnsafe(`
      INSERT INTO "QDCreditLedger" ("id", "address", "delta", "direction", "reason", "counterparty", "txRef", "idempotencyKey", "createdAt")
      VALUES ('${crypto.randomUUID()}', '${callerSafe}', 100, 'IN', 'claim_daily', 'system', '${txRef}', '${txRef}', '${dateStr}')
    `);

    return NextResponse.json({ success: true, amount: 100 });
  } catch (error: any) {
    console.error('[Claim API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
