/**
 * /api/beta/cusdc/member?address=0x…: whether a chat peer is an active member of the closed cUSDC
 * beta, so the private payment form can stop a cUSDC payment the recipient could not see.
 *   GET  { member: boolean }
 *
 * Asked only by an active member (lib/beta/cusdc-beta-store.ts recipientAnswer), with a signed
 * session and a rate limit, so it cannot be used to list who is in the beta. Stores nothing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { cusdcBetaEntry } from '@/lib/beta/cusdc-beta';
import { recipientAnswer } from '@/lib/beta/cusdc-beta-store';
import { prismaBetaStore } from '@/lib/beta/cusdc-beta-prisma';
import record from '../../../../../deployments/aztec-mainnet.json';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const who = (await getVerifiedCaller(req))?.toLowerCase() ?? null;
  if (!who || !/^0x[0-9a-f]{40}$/.test(who)) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401, headers: NO_STORE });
  if (cusdcBetaEntry(record)?.enabled !== true) return NextResponse.json({ error: 'The cUSDC beta is not open.' }, { status: 503, headers: NO_STORE });
  const address = (req.nextUrl.searchParams.get('address') || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) return NextResponse.json({ error: 'Give an Ethereum address.' }, { status: 400, headers: NO_STORE });
  const rl = await checkRateLimit(who, { max: 120, windowSec: 3600, prefix: 'rl:cusdc-beta-member' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many checks. Try again later.' }, { status: 429, headers: NO_STORE });
  try {
    const [caller, target] = await Promise.all([prismaBetaStore.findMember(who), prismaBetaStore.findMember(address)]);
    const r = recipientAnswer(caller, target);
    return NextResponse.json(r.body, { status: r.status, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'The beta status is not available right now.' }, { status: 503, headers: NO_STORE });
  }
}
