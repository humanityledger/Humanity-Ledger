/**
 * POST /api/wallet/payment-report — a wallet transaction event (lib/aztec/wallet/payment-report.ts),
 * written to the server log as one line, as /api/chat/delivery-report does for messages. Only the
 * stage, the kind of transaction, the network, a reason code and a duration are accepted. On Alpha
 * the stage and reason are also counted per hour (lib/ops/counters.ts, package 6); no amount,
 * address, hash or error text is accepted or stored. Signed-in accounts only,
 * 30 reports a minute.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { PAYMENT_REASONS, PAYMENT_STAGES } from '@/lib/aztec/wallet/payment-report';
import { bumpCounter } from '@/lib/ops/counters';

export const dynamic = 'force-dynamic';

const STAGES = new Set<string>(PAYMENT_STAGES);
const REASONS = new Set<string>(PAYMENT_REASONS);
const KINDS = new Set(['shield', 'unshield', 'send', 'faucet', 'deploy', 'issue', 'operator']);
const NETWORKS = new Set(['mainnet', 'testnet', 'local']);

export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return new NextResponse(null, { status: 204 });
  const rl = await checkRateLimit(auth.walletAddress.toLowerCase(), { max: 30, windowSec: 60, prefix: 'rl:payment-report' });
  if (!rl.allowed) return new NextResponse(null, { status: 204 });
  const body = await req.json().catch(() => ({}));
  if (!STAGES.has(body?.stage)) return new NextResponse(null, { status: 204 });
  const kind = KINDS.has(body?.kind) ? body.kind : 'other';
  const network = NETWORKS.has(body?.network) ? body.network : 'other';
  const reason = body?.stage === 'failed' ? (REASONS.has(body?.reason) ? body.reason : 'other') : '';
  const ms = Number.isFinite(body?.ms) && body.ms >= 0 && body.ms < 3_600_000 ? Math.round(body.ms) : '';
  if (network === 'mainnet') {
    await bumpCounter('payment', body.stage);
    if (reason) await bumpCounter('payment', `failed_${reason}`);
  }
  console.warn(`[payment] stage=${body.stage} kind=${kind} network=${network}${reason ? ` reason=${reason}` : ''}${ms !== '' ? ` ms=${ms}` : ''}`);
  return new NextResponse(null, { status: 204 });
}
