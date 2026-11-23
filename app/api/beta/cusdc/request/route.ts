/**
 * POST /api/beta/cusdc/request {}: the signed-in wallet asks for a place in the closed cUSDC beta
 * (lib/beta/cusdc-beta-request.ts). Stores the wallet address and the date only. Signed session,
 * JSON only, rate limited per wallet. The operator approves a request by reserving an invitation
 * for the wallet; GET /api/beta/cusdc/status then reports `reserved: true`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { betaCapacity, cusdcBetaEntry } from '@/lib/beta/cusdc-beta';
import { remainingPlaces } from '@/lib/beta/cusdc-beta-store';
import { prismaBetaStore } from '@/lib/beta/cusdc-beta-prisma';
import { requestPlace } from '@/lib/beta/cusdc-beta-request';
import { prismaRequestStore } from '@/lib/beta/cusdc-beta-request-prisma';
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
  const rl = await checkRateLimit(who, { max: 5, windowSec: 3600, prefix: 'rl:cusdc-beta-request' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts. Try again in an hour.' }, { status: 429, headers: NO_STORE });
  const entry = cusdcBetaEntry(record);
  try {
    const capacity = betaCapacity(entry);
    const [member, members] = await Promise.all([prismaBetaStore.findMember(who), prismaBetaStore.countMembers().catch(() => null)]);
    const r = await requestPlace(prismaRequestStore, {
      wallet: who,
      open: entry?.enabled === true,
      remaining: remainingPlaces(capacity, members),
      isMember: !!member,
      now: new Date(),
    });
    return NextResponse.json(r.body, { status: r.status, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'The request could not be saved. Try again later.' }, { status: 503, headers: NO_STORE });
  }
}
