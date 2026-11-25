/**
 * The compiled PortalToken description (contracts/aztec/portal_token, built by CI's nargo job),
 * served to the private wallet (lib/aztec/wallet/client.ts portalArtifact). Set
 * NEXT_PUBLIC_HL_PORTAL_TOKEN_ARTIFACT=/api/portal/artifact. The wallet does not trust it blindly:
 * registerContract refuses an artifact whose class id differs from the deployed instance's.
 */
import { NextResponse } from 'next/server';
import artifact from '@/contracts/aztec/portal_token/target/portal_token-PortalToken.json';

export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(artifact, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
