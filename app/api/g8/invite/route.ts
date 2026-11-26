import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { isMutuallyBlocked } from '@/lib/chat/blockFirewall';
import { decodeInvite, verifyInvite } from '@/lib/g8/invite';
import { invitedBy, redeemInvite } from '@/lib/g8/server';

export const dynamic = 'force-dynamic';

/** GET → wallets that redeemed MY invites (issuer only), so my client admits them. */
export async function GET(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  return NextResponse.json({ admitted: await invitedBy(auth.walletAddress) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST { token } → redeem a single-use Level-0 invite (signature, expiry, once). */
export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const rl = await checkRateLimit(`${auth.walletAddress}:${getClientIP(req)}`, { max: 10, windowSec: 60, prefix: 'rl:g8-invite' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const inv = decodeInvite(String((await req.json().catch(() => null))?.token ?? ''));
  if (!inv) return NextResponse.json({ error: 'Invalid invite' }, { status: 400 });
  const v = await verifyInvite(inv);
  if (!v.ok) return NextResponse.json({ error: v.reason === 'expired' ? 'This invite has expired' : 'Invalid invite' }, { status: 400 });
  if (inv.payload.issuer === auth.walletAddress) return NextResponse.json({ error: 'This is your own invite' }, { status: 400 });
  if (await isMutuallyBlocked(auth.walletAddress, inv.payload.issuer)) return NextResponse.json({ error: 'unavailable' }, { status: 403 });
  if (!(await redeemInvite(inv.payload.jti, inv.payload.issuer, auth.walletAddress))) return NextResponse.json({ error: 'This invite was already used' }, { status: 409 });
  return NextResponse.json({ ok: true, issuer: inv.payload.issuer });
}
