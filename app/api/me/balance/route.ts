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
 * GET /api/me/balance
 * Returns the Quantum Dots (QD) Balance for the current user.
 * 
 * Complies with HL-LC-500 requirement LC-346:
 * Contrato: GET /api/me/balance devuelve {available,pendingIn,pendingOut,updatedAt,source,version}.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Auto-heal: Ensure QDCreditLedger table exists (bypassing Prisma Client sync issues)
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

    // 2. Calculate balance dynamically from the ledger
    const callerSafe = caller.replace(/'/g, "''");
    const result = await prisma.$queryRaw`SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN delta ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN direction = 'OUT' THEN delta ELSE 0 END), 0) as available, COUNT(*) as version FROM "QDCreditLedger" WHERE "address" = ${caller}` as any[];

    // LC-258, LC-346: Exact contract shape
    const available = result[0]?.available || 0;
    const version = Number(result[0]?.version || 0);

    return NextResponse.json({
      available: available,
      pendingIn: 0,
      pendingOut: 0,
      updatedAt: new Date().toISOString(),
      source: 'db', // source ∈ {cache, db, rpc, aztec, mock} according to LC-259
      version: version
    });

  } catch (error: any) {
    console.error('[Balance API]', error);
    // LC-336: Degradación parcial. Never hide QDs entirely on error, return safe fallback.
    return NextResponse.json({
      available: 0,
      pendingIn: 0,
      pendingOut: 0,
      updatedAt: new Date().toISOString(),
      source: 'error',
      version: 0
    });
  }
}
