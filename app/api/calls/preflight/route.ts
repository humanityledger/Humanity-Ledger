import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { isMutuallyBlocked, normalizePeer } from '@/lib/chat/blockFirewall';

export const dynamic = 'force-dynamic';

/**
 * POST /api/calls/preflight { peer } — asked before ringing someone.
 * A block in either direction answers 403 "unavailable" at once, so the caller
 * sees a neutral message instead of 45 s of ringing; it never says who blocked.
 */
export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const rl = await checkRateLimit(`${auth.walletAddress}:${getClientIP(req)}`, { max: 30, windowSec: 60, prefix: 'rl:call-preflight' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const body = await req.json().catch(() => null);
  const peer = normalizePeer(body?.peer);
  if (!peer || peer === auth.walletAddress) return NextResponse.json({ error: 'Invalid peer' }, { status: 400 });
  if (await isMutuallyBlocked(auth.walletAddress, peer)) {
    return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
