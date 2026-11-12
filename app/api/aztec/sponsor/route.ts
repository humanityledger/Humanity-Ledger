import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { signVoucher, sponsorLimits, sponsorPublicKey } from '@/lib/aztec/sponsor-voucher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const address = () => (process.env.NEXT_PUBLIC_AZTEC_SPONSOR || '').trim();

/**
 * GET  /api/aztec/sponsor — whether sponsorship is on, the sponsor address, and the public key the
 *      contract must be deployed with (public data; used by the deploy screen).
 * POST /api/aztec/sponsor — a one-use voucher for the signed-in wallet, within the limits
 *      (AZTEC_SPONSOR_PER_WALLET for life, AZTEC_SPONSOR_PER_DAY for everyone).
 */
export async function GET() {
  const key = sponsorPublicKey();
  return NextResponse.json({ address: address() || null, enabled: Boolean(address() && key), signer: key, limits: sponsorLimits() });
}

export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  if (!address()) return NextResponse.json({ error: 'NOT_CONFIGURED', message: 'Sponsored fees are not on yet.' }, { status: 503 });
  const { perWallet, perDay } = sponsorLimits();
  const wallet = auth.walletAddress.toLowerCase();
  const mine = await checkRateLimit(`w:${wallet}`, { max: perWallet, windowSec: 10 * 365 * 86400, prefix: 'aztec-sponsor' });
  if (!mine.allowed) {
    return NextResponse.json({ error: 'USED_UP', message: 'This account has used its sponsored transactions. Add Fee Juice to continue.' }, { status: 429 });
  }
  const day = await checkRateLimit('all', { max: perDay, windowSec: 86400, prefix: 'aztec-sponsor-day' });
  if (!day.allowed) {
    return NextResponse.json({ error: 'DAILY_LIMIT', message: 'Sponsored fees are used up for today. Try again tomorrow or add Fee Juice.' }, { status: 429 });
  }
  const voucher = signVoucher();
  if (!voucher) return NextResponse.json({ error: 'NOT_CONFIGURED', message: 'Sponsored fees are not on yet.' }, { status: 503 });
  return NextResponse.json({ sponsor: address(), ...voucher });
}
