import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { isMutuallyBlocked } from '@/lib/chat/blockFirewall';
import { issueChallenge, normAddr } from '@/lib/g8/server';

export const dynamic = 'force-dynamic';

/** POST { recipient } → single-use nonce for a G8 admission proof to that recipient (spec §5–§6). */
export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const rl = await checkRateLimit(`${auth.walletAddress}:${getClientIP(req)}`, { max: 20, windowSec: 60, prefix: 'rl:g8-challenge' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const recipient = normAddr((await req.json().catch(() => null))?.recipient);
  if (!recipient || recipient === auth.walletAddress) return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 });
  if (await isMutuallyBlocked(auth.walletAddress, recipient)) return NextResponse.json({ error: 'unavailable' }, { status: 403 });
  return NextResponse.json({ nonce: await issueChallenge(auth.walletAddress, recipient), tNow: Math.floor(Date.now() / 1000) }, { headers: { 'Cache-Control': 'no-store' } });
}
