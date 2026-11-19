/**
 * /api/alpha/fee-juice-grants — the record of Fee Juice grants to testers (package 5, OD-9).
 *   GET                 { budget, spent, grants }   (admins only)
 *   GET ?format=csv     the same grants as CSV, for the tax adviser
 *   POST { recipientAztecAddress, amount, txHash, network, marketValueEur, valueSource }
 *
 * Admins only (ALPHA_ADMINS, OD-4). Nothing is sent from here: Stefan makes each grant with his
 * own keys and reports the hash. The transaction is looked up read-only, on Ethereum for a portal
 * deposit (l1) or on the Aztec node (l2); a hash that is not found or not successful is refused.
 * Refused too when ALPHA_FEE_JUICE_BUDGET is empty, or when the grant would exceed it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { parseAlphaAdmins } from '@/lib/alpha/invites';
import { FEE_JUICE_DECIMALS, grantProblem, grantsCsv, parseBudget, type GrantInput } from '@/lib/alpha/fee-juice-grants';
import { formatUnits, parseUnits } from '@/lib/aztec/wallet/amounts';
import { AZTEC_NETWORKS } from '@/lib/aztec/sequencer/networks';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

async function admin(req: NextRequest): Promise<string | null> {
  const w = (await getVerifiedCaller(req))?.toLowerCase() ?? null;
  return w && parseAlphaAdmins(process.env.ALPHA_ADMINS).has(w) ? w : null;
}

async function rpc(url: string, method: string, params: unknown[]): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) throw new Error(`${method} failed`);
  return body.result;
}

/** The block of a successful transaction, read-only, or null when it is not found or failed. */
async function minedBlock(network: 'l1' | 'l2', txHash: string): Promise<number | null> {
  if (network === 'l1') {
    const url = process.env.FEE_JUICE_L1_RPC_URL || process.env.NEXT_PUBLIC_ETH_RPC_URL || '';
    if (!url) throw new Error('No Ethereum RPC is configured (FEE_JUICE_L1_RPC_URL).');
    const r = await rpc(url, 'eth_getTransactionReceipt', [txHash]);
    return r && r.status === '0x1' && typeof r.blockNumber === 'string' ? Number(BigInt(r.blockNumber)) : null;
  }
  const r = await rpc(process.env.AZTEC_MAINNET_NODE_URL || AZTEC_NETWORKS.mainnet.publicNodeRpc, 'node_getTxReceipt', [txHash]);
  const ok = r && (r.status === 'success' || r.status === 'mined' || r.status === 'checkpointed' || r.status === 'proven' || r.status === 'finalized');
  const block = Number(r?.blockNumber ?? 0);
  return ok && block > 0 ? block : null;
}

async function totals() {
  const rows = await prisma.feeJuiceGrant.findMany({ orderBy: { grantedAt: 'asc' } });
  const spent = rows.reduce((s, r) => s + parseUnits(r.amount, FEE_JUICE_DECIMALS), 0n);
  return { rows, spent };
}

export async function GET(req: NextRequest) {
  if (!(await admin(req))) return NextResponse.json({ error: 'Admins only.' }, { status: 403, headers: NO_STORE });
  const { rows, spent } = await totals();
  if (req.nextUrl.searchParams.get('format') === 'csv') {
    return new NextResponse(grantsCsv(rows), { headers: { ...NO_STORE, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="fee-juice-grants.csv"' } });
  }
  const budget = parseBudget(process.env.ALPHA_FEE_JUICE_BUDGET);
  return NextResponse.json({
    budget: budget === null ? null : formatUnits(budget, FEE_JUICE_DECIMALS, 4),
    spent: formatUnits(spent, FEE_JUICE_DECIMALS, 4),
    grants: rows,
  }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const by = await admin(req);
  if (!by) return NextResponse.json({ error: 'Admins only.' }, { status: 403, headers: NO_STORE });
  const body = (await req.json().catch(() => ({}))) as Partial<GrantInput>;
  const { spent } = await totals();
  const problem = grantProblem(body, parseBudget(process.env.ALPHA_FEE_JUICE_BUDGET), spent);
  if (problem) return NextResponse.json({ error: problem }, { status: 400, headers: NO_STORE });
  let block: number | null;
  try {
    block = await minedBlock(body.network!, body.txHash!);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'The network could not be read.' }, { status: 502, headers: NO_STORE });
  }
  if (block === null) return NextResponse.json({ error: 'That transaction was not found, or it did not succeed.' }, { status: 400, headers: NO_STORE });
  // R2-3: the budget is checked again under a lock with the grant it admits, so two grants
  // recorded together cannot pass it; a hash already recorded is a 409, not a 500.
  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72707371)`;
      const rows = await tx.feeJuiceGrant.findMany({ select: { amount: true } });
      const spentNow = rows.reduce((s, r) => s + parseUnits(r.amount, FEE_JUICE_DECIMALS), 0n);
      const again = grantProblem(body, parseBudget(process.env.ALPHA_FEE_JUICE_BUDGET), spentNow);
      if (again) return again;
      return tx.feeJuiceGrant.create({
        data: {
          recipientAztecAddress: body.recipientAztecAddress!.toLowerCase(),
          amount: body.amount!,
          network: body.network!,
          txHash: body.txHash!.toLowerCase(),
          block: block!,
          marketValueEur: body.marketValueEur!,
          valueSource: body.valueSource!.trim().slice(0, 200),
          recordedBy: by,
        },
      });
    });
    if (typeof row === 'string') return NextResponse.json({ error: row }, { status: 400, headers: NO_STORE });
    return NextResponse.json({ grant: row }, { headers: NO_STORE });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return NextResponse.json({ error: 'That transaction is already recorded.' }, { status: 409, headers: NO_STORE });
    throw e;
  }
}
