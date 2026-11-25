/**
 * POST /api/xmtp/token: a 10-minute credential for our own XMTP backend, for the signed-in wallet.
 * Off (503) until the operator configures the self-hosted backend (lib/xmtp/backend-token.ts,
 * docs/xmtp/SELF_HOSTED_MIGRATION.md). The backend sees a pseudonymous subject, never the wallet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { backendTokenKeys, issueBackendCredential } from '@/lib/xmtp/backend-token';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: NextRequest) {
  const keys = backendTokenKeys();
  if (!keys) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 503, headers: NO_STORE });
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const rl = await checkRateLimit(auth.walletAddress.toLowerCase(), { max: 30, windowSec: 600, prefix: 'rl:xmtp-token' });
  if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: NO_STORE });
  const credential = await issueBackendCredential(auth.walletAddress, keys);
  return NextResponse.json(credential, { headers: NO_STORE });
}
