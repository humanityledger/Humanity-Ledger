/**
 * POST /api/chat/username/link   { token }
 *
 * Opens a profile link or QR code: returns the account behind the token. The token is the
 * random part after "#" in https://ledgerchat.org/u#<token>; resetting the link replaces it, so
 * an old link answers 404. Signed-in only, rate limited.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { LINK_TOKEN_RE } from '@/lib/chat/usernames';
import { guardUsernameStore } from '@/lib/chat/usernameRouteGuard';

export const dynamic = 'force-dynamic';

async function handlePOST(req: NextRequest) {
  const who = (await getVerifiedCaller(req))?.toLowerCase();
  if (!who) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const rl = await checkRateLimit(who, { max: 30, windowSec: 60, prefix: 'rl:username-link-open' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Wait a minute.' }, { status: 429 });
  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const token = typeof body.token === 'string' ? body.token : '';
  if (!LINK_TOKEN_RE.test(token)) return NextResponse.json({ found: false }, { status: 404 });
  const row = await prisma.chatUsername.findUnique({ where: { linkToken: token } });
  if (!row) return NextResponse.json({ found: false }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ found: true, address: row.walletAddress, username: row.username }, { headers: { 'Cache-Control': 'no-store' } });
}

export const POST = guardUsernameStore('api/chat/username/link POST', handlePOST);
