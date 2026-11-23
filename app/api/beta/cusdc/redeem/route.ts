/**
 * POST /api/beta/cusdc/redeem { code, notice: true, noticeVersion }: the signed-in wallet joins the
 * closed cUSDC beta with an invitation code (lib/beta/cusdc-beta-store.ts).
 *
 * Open only while cusdcBeta.enabled is true in deployments/aztec-mainnet.json. At most 100 members
 * (or the lower cusdcBeta.maxTesters), enforced under a database lock. Signed session only, rate
 * limited per wallet, one answer for every bad code. Joining does not by itself show cUSDC: the
 * wallet also needs the on-chain confirmation and the cap (GET /api/beta/cusdc/status, access).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { betaCapacity, cusdcBetaEntry } from '@/lib/beta/cusdc-beta';
import { BAD_CODE, redeemBetaInvite } from '@/lib/beta/cusdc-beta-store';
import { prismaBetaStore } from '@/lib/beta/cusdc-beta-prisma';
import { applyBetaPass } from '@/lib/beta/pass';
import record from '../../../../../deployments/aztec-mainnet.json';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: NextRequest) {
  const who = (await getVerifiedCaller(req))?.toLowerCase() ?? null;
  if (!who || !/^0x[0-9a-f]{40}$/.test(who)) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401, headers: NO_STORE });
  // JSON only: a cross-site form cannot send application/json without a preflight (CSRF defence in depth).
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'Send JSON.' }, { status: 415, headers: NO_STORE });
  }
  const rl = await checkRateLimit(who, { max: 5, windowSec: 3600, prefix: 'rl:cusdc-beta-redeem' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts. Try again in an hour.' }, { status: 429, headers: NO_STORE });
  let body: { code?: unknown; notice?: unknown; noticeVersion?: unknown; reserved?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: BAD_CODE }, { status: 400, headers: NO_STORE });
  }
  const entry = cusdcBetaEntry(record);
  try {
    const r = await redeemBetaInvite(prismaBetaStore, {
      wallet: who,
      code: body.code,
      notice: body.notice,
      noticeVersion: body.noticeVersion,
      // An invitation the operator reserved for this wallet (an approved request): no code.
      reserved: body.reserved === true,
      pepper: process.env.ALPHA_INVITE_PEPPER || '',
      capacity: betaCapacity(entry),
      open: entry?.enabled === true,
      now: new Date(),
    });
    const res = NextResponse.json(r.body, { status: r.status, headers: NO_STORE });
    // A new member gets the chat pass at once, so the redirect to /chat is not sent back to /beta.
    if (r.status === 200) await applyBetaPass(res, who, true);
    return res;
  } catch {
    return NextResponse.json({ error: BAD_CODE }, { status: 400, headers: NO_STORE });
  }
}
