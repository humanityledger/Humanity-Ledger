import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { getIdentityStatus } from '@/lib/identity-gate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/aztec/identity-status
 *
 * Returns the full identity status for the currently authenticated wallet:
 *  - Whether they are a verified identity (have claimed their airdrop)
 *  - Their Aztec address
 *  - The claim transaction hash
 *  - The total number of identities claimed globally
 *  - How many remain from the 200-identity supply cap
 *
 * This endpoint is PUBLIC in the sense that it returns status info,
 * but it uses the session to look up the specific caller's identity.
 * Unauthenticated callers get the global supply status only.
 */
export async function GET(req: NextRequest) {
  try {
    const callerAddress = (await getVerifiedCaller(req)) ?? '';

    const status = await getIdentityStatus(callerAddress);

    return NextResponse.json({
      ...status,
      supplyCapTotal: Number(process.env.IDENTITY_CAP ?? 200),
      network: 'aztec-mainnet',
      message: status.verified
        ? '✅ Verified Humanity Ledger Identity — Full domain access granted.'
        : status.capReached
          ? '🔒 All 200 identities have been claimed. The network is closed.'
          : `${status.remaining} of ${Number(process.env.IDENTITY_CAP ?? 200)} identities remain. Claim yours at /api/aztec/airdrop.`,
    });
  } catch (err: any) {
    console.error('[Identity Status] Error:', err.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
