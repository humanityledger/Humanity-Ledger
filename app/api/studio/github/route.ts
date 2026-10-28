import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { appOrigin, claimToken, createState, GITHUB_SCOPE, githubOAuthConfig } from '@/lib/studio/github-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** GET /api/studio/github — whether "Sign in with GitHub" is available. */
export async function GET(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  return json(200, { oauth: !!githubOAuthConfig() });
}

/**
 * POST /api/studio/github
 *   { action: "start" }          → { url, state }: open url in a popup
 *   { action: "claim", state }   → { token } once the popup has finished (404 until then)
 */
export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const cfg = githubOAuthConfig();
  if (!cfg) return json(404, { error: 'NOT_CONFIGURED' });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: 'BAD_REQUEST' }); }

  if (body?.action === 'start') {
    const rl = await checkRateLimit(`${auth.walletAddress.toLowerCase()}:${getClientIP(req)}`, { max: 20, windowSec: 3600, prefix: 'rl:studio-gh' });
    if (!rl.allowed) return json(429, { error: 'RATE_LIMITED' });
    const state = await createState(auth.walletAddress);
    if (!state) return json(503, { error: 'UNAVAILABLE' });
    const u = new URL('https://github.com/login/oauth/authorize');
    u.searchParams.set('client_id', cfg.clientId);
    u.searchParams.set('redirect_uri', `${appOrigin(req.url)}/api/studio/github/callback`);
    u.searchParams.set('scope', GITHUB_SCOPE);
    u.searchParams.set('state', state);
    u.searchParams.set('allow_signup', 'true');
    return json(200, { url: u.toString(), state });
  }
  if (body?.action === 'claim' && typeof body.state === 'string') {
    const token = await claimToken(body.state, auth.walletAddress);
    return token ? json(200, { token }) : json(404, { error: 'PENDING' });
  }
  return json(400, { error: 'BAD_REQUEST' });
}
