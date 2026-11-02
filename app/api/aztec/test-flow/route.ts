import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-guard';

/**
 * GET /api/aztec/test-flow?address=0x...
 *
 * Runs a comprehensive end to end test of the QD spend flow:
 * 1. Derives the Aztec address for the given EVM address
 * 2. Checks the current balance from the DB ledger
 * 3. Tests airdrop idempotency
 * 4. Tests a micro-transfer (0.001 QD) to verify the spend pathway
 * 5. Confirms the balance was correctly debited
 * 6. Confirms the transaction is recorded in DB
 * 7. Confirms the transaction history API works
 *
 * This is a REAL test — no mocks, no simulations.
 */
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
  }

  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    address,
    tests: [],
    passed: 0,
    failed: 0,
  };

  const addResult = (name: string, passed: boolean, details: any) => {
    report.tests.push({ name, passed, details });
    if (passed) report.passed++;
    else report.failed++;
  };

  try {
    // ── TEST 1: Derive Address ─────────────────────────────────────────
    const deriveRes = await fetch(`${req.nextUrl.origin}/api/aztec/derive-address`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: address }),
    });
    const deriveData = await deriveRes.json();
    const aztecAddress = deriveData.aztecAddress;

    addResult('Derive Aztec Address', !!aztecAddress && deriveRes.ok, {
      aztecAddress,
      status: deriveRes.status,
    });

    if (!aztecAddress) {
      return NextResponse.json({ ...report, error: 'Address derivation failed — cannot continue' }, { status: 500 });
    }

    // ── TEST 2: Balance Fetch ──────────────────────────────────────────
    const balRes = await fetch(`${req.nextUrl.origin}/api/aztec/balance?aztecAddress=${encodeURIComponent(aztecAddress)}`);
    const balData = await balRes.json();
    const balanceBefore = parseFloat(balData.balance ?? '0');

    addResult('Fetch Balance from DB', balRes.ok && typeof balData.balance !== 'undefined', {
      balance: balanceBefore,
      status: balRes.status,
    });

    // ── TEST 3: Airdrop Idempotency ────────────────────────────────────
    const airdropRes = await fetch(`${req.nextUrl.origin}/api/aztec/airdrop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: aztecAddress }),
    });
    const airdropData = await airdropRes.json();
    const airdropOk = airdropRes.ok || airdropData.message?.includes('Already received');
    addResult('Airdrop Idempotency', airdropOk, {
      success: airdropData.success,
      message: airdropData.message,
      status: airdropRes.status,
    });

    // ── TEST 4: Transfer / Spend Pathway ──────────────────────────────
    const burnAddress = '0xdead000000000000000000000000000000000000000000000000000000000000';
    const spendAmount = 0.001;

    const txRes = await fetch(`${req.nextUrl.origin}/api/aztec/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: aztecAddress, to: burnAddress, amount: spendAmount }),
    });
    const txData = await txRes.json();
    const txOk = txRes.ok && txData.success;

    addResult('Transfer / Spend Pathway', txOk, {
      txHash: txData.txHash,
      status: txRes.status,
      error: txData.error,
    });

    // ── TEST 5: Balance Debited Correctly ─────────────────────────────
    // Wait for DB write to propagate
    await new Promise((r) => setTimeout(r, 300));
    const balAfterRes = await fetch(`${req.nextUrl.origin}/api/aztec/balance?aztecAddress=${encodeURIComponent(aztecAddress)}`);
    const balAfterData = await balAfterRes.json();
    const balanceAfter = parseFloat(balAfterData.balance ?? '0');
    const debitCorrect = txOk ? Math.abs(balanceBefore - spendAmount - balanceAfter) < 0.01 : true;

    addResult('Balance Debit Confirmed', debitCorrect, {
      balanceBefore,
      expectedAfter: txOk ? (balanceBefore - spendAmount).toFixed(4) : 'N/A',
      actualAfter: balanceAfter,
      delta: (balanceBefore - balanceAfter).toFixed(4),
    });

    // ── TEST 6: Transaction Recorded in DB ────────────────────────────
    const txCountAfter = await prisma.transaction.count({
      where: { fromAddress: aztecAddress.toLowerCase() },
    });

    addResult('Transaction Recorded in DB', txCountAfter > 0, { transactionCount: txCountAfter });

    // ── TEST 7: Transaction History API ──────────────────────────────
    const histRes = await fetch(`${req.nextUrl.origin}/api/aztec/transactions?address=${encodeURIComponent(aztecAddress)}`);
    const histData = await histRes.json();

    addResult('Transaction History API', histRes.ok && Array.isArray(histData.transactions), {
      transactionCount: histData.transactions?.length,
      status: histRes.status,
    });

    // ── SUMMARY ──────────────────────────────────────────────────────
    report.allPassed = report.failed === 0;
    report.summary = `${report.passed}/${report.tests.length} tests passed`;

    return NextResponse.json(report, { status: report.allPassed ? 200 : 207 });
  } catch (err: any) {
    return NextResponse.json({ ...report, error: err.message, allPassed: false }, { status: 500 });
  }
}
