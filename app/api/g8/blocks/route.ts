import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { listBlindBlocks, normFingerprint, setBlindBlock } from '@/lib/g8/server';

export const dynamic = 'force-dynamic';

/** Blind person-blocks: only SHA-256 fingerprints, never tags or identities (spec §3, §6). */
export async function GET(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  return NextResponse.json({ fingerprints: await listBlindBlocks(auth.walletAddress) }, { headers: { 'Cache-Control': 'no-store' } });
}
async function change(req: NextRequest, on: boolean) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const rl = await checkRateLimit(`${auth.walletAddress}:${getClientIP(req)}`, { max: 60, windowSec: 60, prefix: 'rl:g8-blocks' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const fp = normFingerprint((await req.json().catch(() => null))?.fingerprint);
  if (!fp) return NextResponse.json({ error: 'Invalid fingerprint' }, { status: 400 });
  await setBlindBlock(auth.walletAddress, fp, on);
  return NextResponse.json({ ok: true });
}
export const POST = (req: NextRequest) => change(req, true);
export const DELETE = (req: NextRequest) => change(req, false);
