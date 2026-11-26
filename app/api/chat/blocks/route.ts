import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { listOwnBlocks, normalizePeer, setServerBlock } from '@/lib/chat/blockFirewall';

export const dynamic = 'force-dynamic';

/** GET: the caller's own block list (never who blocked the caller). */
export async function GET(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  return NextResponse.json({ blocked: await listOwnBlocks(auth.walletAddress) }, { headers: { 'Cache-Control': 'no-store' } });
}

async function change(req: NextRequest, blocked: boolean) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const rl = await checkRateLimit(`${auth.walletAddress}:${getClientIP(req)}`, { max: 60, windowSec: 60, prefix: 'rl:chat-blocks' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const body = await req.json().catch(() => null);
  const peer = normalizePeer(body?.peer);
  if (!peer || peer === auth.walletAddress) return NextResponse.json({ error: 'Invalid peer' }, { status: 400 });
  try {
    await setServerBlock(auth.walletAddress, peer, blocked);
  } catch {
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, peer, blocked });
}

export const POST = (req: NextRequest) => change(req, true);
export const DELETE = (req: NextRequest) => change(req, false);
