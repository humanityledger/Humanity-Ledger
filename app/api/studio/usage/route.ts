import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { readUsage } from '@/lib/studio/metering';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/studio/usage — plan, budget used and left, and whether Studio is configured. */
export async function GET(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const usage = await readUsage(auth.walletAddress);
  return NextResponse.json(
    {
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      checkoutAvailable: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_STUDIO_PRO),
      usage,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
