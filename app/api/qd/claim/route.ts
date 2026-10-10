import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

async function resolveCaller(req: NextRequest) {
  // [SECURITY] Session cookie is the authoritative identity source.
  // The x-verified-session-address header is injected by middleware from the JWT,
  // which is itself derived from the session cookie, so it is also trustworthy
  // in the context where middleware has run. We prefer the session cookie as primary.
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  // Middleware-verified header as fallback (still JWT-backed)
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  return null;
}

/**
 * POST /api/qd/claim
 * Allows a user to claim 100 QDs once per 24 hours. (Anti-sybil LC-267)
 * [SECURITY FIX] Replaced $executeRawUnsafe + string interpolation (SQL Injection risk)
 * with parameterized $queryRaw and $executeRaw template literals.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Auto-heal table (DDL is not injectable)
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

    // Check last claim — PARAMETERIZED
    const lastClaims = await prisma.$queryRaw`
      SELECT "createdAt" FROM "QDCreditLedger"
      WHERE "address" = ${caller} AND "reason" = 'claim_daily'
      ORDER BY "createdAt" DESC LIMIT 1
    ` as any[];

    if (lastClaims.length > 0) {
      const lastClaimTime = new Date(lastClaims[0].createdAt).getTime();
      const now = Date.now();
      if (now - lastClaimTime < 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'Daily claim limit reached. Try again tomorrow.' }, { status: 429 });
      }
    }

    const txRef = 'claim_' + Date.now();
    const newId = crypto.randomUUID();
    const now = new Date();

    // Credit receiver — PARAMETERIZED
    await prisma.$executeRaw`
      INSERT INTO "QDCreditLedger" ("id", "address", "delta", "direction", "reason", "counterparty", "txRef", "idempotencyKey", "createdAt")
      VALUES (${newId}, ${caller}, ${100}::float8, 'IN', 'claim_daily', 'system', ${txRef}, ${txRef}, ${now})
    `;

    return NextResponse.json({ success: true, amount: 100 });
  } catch (error: any) {
    console.error('[Claim API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
