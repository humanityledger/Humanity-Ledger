/**
 * GET /api/chat/username/lookup?u=<username>
 *
 * Finds an account by its exact username, as Signal does: no prefix or partial match, so nobody
 * can walk the directory by typing a few letters. Signed-in only, rate limited.
 * 200 { address, username, name } · 404 when nobody has that name.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { canonicalUsername, usernameProblem } from '@/lib/chat/usernames';
import { guardUsernameStore } from '@/lib/chat/usernameRouteGuard';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  const who = (await getVerifiedCaller(req))?.toLowerCase();
  if (!who) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const rl = await checkRateLimit(who, { max: 30, windowSec: 60, prefix: 'rl:username-lookup' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many searches. Wait a minute.' }, { status: 429 });
  const raw = (req.nextUrl.searchParams.get('u') ?? '').slice(0, 64);
  const problem = usernameProblem(raw);
  // A name that could never be saved (reserved included) cannot belong to anyone.
  if (problem) return NextResponse.json({ found: false }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const username = canonicalUsername(raw);
  const row = await prisma.chatUsername.findUnique({ where: { username } });
  if (!row) return NextResponse.json({ found: false }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const user = await prisma.user.findUnique({ where: { walletAddress: row.walletAddress }, select: { chatName: true, displayName: true } });
  const name = user?.chatName && user.chatName !== 'Ledger User' ? user.chatName : user?.displayName ?? null;
  return NextResponse.json({ found: true, address: row.walletAddress, username: row.username, name }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = guardUsernameStore('api/chat/username/lookup GET', handleGET);
