import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function resolveCaller(req: NextRequest) {
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  return req.headers.get('x-web3-address')?.toLowerCase();
}

/**
 * POST /api/qd/transfer
 * Handles internal transfer of Quantum Dots (QDs) between users.
 * Complies with LC-264, LC-265, LC-266, LC-268.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { to, amount, idempotencyKey, fee = 0 } = await req.json();

    if (!to || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (!idempotencyKey) {
      return NextResponse.json({ error: 'idempotencyKey required' }, { status: 400 });
    }

    // LC-301: No self-transfer
    if (caller.toLowerCase() === to.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot send QDs to yourself' }, { status: 400 });
    }

    const callerSafe = caller.replace(/'/g, "''");
    const toSafe = to.toLowerCase().replace(/'/g, "''");
    const idempotencySafe = idempotencyKey.replace(/'/g, "''");
    
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

    // Check idempotency
    const existing = await prisma.$queryRawUnsafe(`
      SELECT id FROM "QDCreditLedger" WHERE "idempotencyKey" = '${idempotencySafe}' LIMIT 1
    `) as any[];

    if (existing.length > 0) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // Check balance
    const result = await prisma.$queryRawUnsafe(`
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'IN' THEN delta ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN direction = 'OUT' THEN delta ELSE 0 END), 0) as available
      FROM "QDCreditLedger"
      WHERE "address" = '${callerSafe}'
    `) as any[];

    const available = result[0]?.available || 0;
    const totalDeduction = amount + fee;

    if (available < totalDeduction) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    const txRef = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const dateStr = new Date().toISOString();

    // Perform the transfer (double entry)
    // 1. Debit sender (Amount)
    await prisma.$executeRawUnsafe(`
      INSERT INTO "QDCreditLedger" ("id", "address", "delta", "direction", "reason", "counterparty", "txRef", "idempotencyKey", "createdAt")
      VALUES ('${crypto.randomUUID()}', '${callerSafe}', ${amount}, 'OUT', 'send_chat', '${toSafe}', '${txRef}', '${idempotencySafe}_out', '${dateStr}')
    `);

    // 2. Debit sender (Fee) if applicable
    if (fee > 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "QDCreditLedger" ("id", "address", "delta", "direction", "reason", "counterparty", "txRef", "idempotencyKey", "createdAt")
        VALUES ('${crypto.randomUUID()}', '${callerSafe}', ${fee}, 'OUT', 'spam_fee', 'system', '${txRef}', '${idempotencySafe}_fee', '${dateStr}')
      `);
    }

    // 3. Credit receiver
    await prisma.$executeRawUnsafe(`
      INSERT INTO "QDCreditLedger" ("id", "address", "delta", "direction", "reason", "counterparty", "txRef", "idempotencyKey", "createdAt")
      VALUES ('${crypto.randomUUID()}', '${toSafe}', ${amount}, 'IN', 'receive_chat', '${callerSafe}', '${txRef}', '${idempotencySafe}_in', '${dateStr}')
    `);

    return NextResponse.json({ success: true, txRef });
  } catch (error: any) {
    console.error('[Transfer API]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
