import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { readUsage } from '@/lib/studio/metering';
import { serverDefaultModel, studioApiKey, studioTpmLimit } from '@/lib/studio/client';
import { STUDIO_CAPABILITIES } from '@/lib/studio/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/studio/usage — plan, allowance used and left, whether Studio is
 * configured (GROQ_API_KEY set), and what this provider can do, so the UI
 * only offers features that work.
 */
export async function GET(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const usage = await readUsage(auth.walletAddress);
  return NextResponse.json(
    {
      configured: Boolean(studioApiKey()),
      provider: 'groq',
      defaultModel: serverDefaultModel(),
      tpmLimit: studioTpmLimit(),
      capabilities: STUDIO_CAPABILITIES,
      checkoutAvailable: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_STUDIO_PRO),
      usage,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
