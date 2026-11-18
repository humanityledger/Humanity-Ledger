/**
 * /api/chat/username — the signed-in account's Ledger Chat username and profile link.
 *
 * GET                              { username, linkToken } or { username: null }
 * PUT    { username }              reserve or change it. 409 { error: 'taken', suggestions } when
 *                                  another account holds it. Unique in the world by the database's
 *                                  unique index, so two accounts saving the same name at the same
 *                                  instant cannot both succeed.
 * POST   { action: 'reset-link' }  a new link token: every old link and QR code stops working
 * DELETE                           remove the username; the name is free again and the link dies
 *
 * Signed-in Ethereum wallets only (getVerifiedCaller). Rate limited per account.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { canonicalUsername, newLinkToken, usernameProblem, usernameSuggestions, USERNAME_PROBLEM_TEXT } from '@/lib/chat/usernames';
import { guardUsernameStore } from '@/lib/chat/usernameRouteGuard';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

async function caller(req: NextRequest): Promise<string | null> {
  const a = (await getVerifiedCaller(req))?.toLowerCase() ?? null;
  return a && /^0x[0-9a-f]{40}$/.test(a) ? a : null;
}

const token = () => newLinkToken((n) => new Uint8Array(randomBytes(n)));

function isUniqueViolation(e: unknown, field?: string): boolean {
  const err = e as { code?: string; meta?: { target?: string[] | string } };
  if (err?.code !== 'P2002') return false;
  if (!field) return true;
  const t = err.meta?.target;
  return Array.isArray(t) ? t.includes(field) : typeof t === 'string' ? t.includes(field) : true;
}

async function handleGET(req: NextRequest) {
  const who = await caller(req);
  if (!who) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401 });
  const row = await prisma.chatUsername.findUnique({ where: { walletAddress: who } });
  return NextResponse.json(row ? { username: row.username, linkToken: row.linkToken } : { username: null, linkToken: null }, { headers: NO_STORE });
}

async function handlePUT(req: NextRequest) {
  const who = await caller(req);
  if (!who) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401 });
  const rl = await checkRateLimit(who, { max: 10, windowSec: 3600, prefix: 'rl:username-set' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many changes. Try again in an hour.' }, { status: 429 });
  let body: { username?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const raw = typeof body.username === 'string' ? body.username.slice(0, 64) : '';
  const problem = usernameProblem(raw);
  if (problem) return NextResponse.json({ error: USERNAME_PROBLEM_TEXT[problem], problem }, { status: 400 });
  const username = canonicalUsername(raw);

  const current = await prisma.chatUsername.findUnique({ where: { walletAddress: who } });
  if (current?.username === username) return NextResponse.json({ username, linkToken: current.linkToken }, { headers: NO_STORE });

  try {
    const row = current
      ? await prisma.chatUsername.update({ where: { walletAddress: who }, data: { username } })
      : await prisma.chatUsername.create({ data: { walletAddress: who, username, linkToken: token() } });
    return NextResponse.json({ username: row.username, linkToken: row.linkToken }, { headers: NO_STORE });
  } catch (e) {
    if (isUniqueViolation(e, 'username')) {
      // Offer endings that are free right now; one query for all of them.
      const candidates = usernameSuggestions(username, 6);
      const takenRows = await prisma.chatUsername.findMany({ where: { username: { in: candidates } }, select: { username: true } });
      const taken = new Set(takenRows.map((r) => r.username));
      return NextResponse.json(
        { error: 'This username is taken. Choose another one.', problem: 'taken', suggestions: candidates.filter((c) => !taken.has(c)).slice(0, 3) },
        { status: 409, headers: NO_STORE },
      );
    }
    if (isUniqueViolation(e, 'linkToken')) return NextResponse.json({ error: 'Try again.' }, { status: 503 });
    throw e;
  }
}

async function handlePOST(req: NextRequest) {
  const who = await caller(req);
  if (!who) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401 });
  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (body.action !== 'reset-link') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  const rl = await checkRateLimit(who, { max: 10, windowSec: 3600, prefix: 'rl:username-link' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many resets. Try again in an hour.' }, { status: 429 });
  const current = await prisma.chatUsername.findUnique({ where: { walletAddress: who } });
  if (!current) return NextResponse.json({ error: 'Choose a username first.' }, { status: 404 });
  const row = await prisma.chatUsername.update({ where: { walletAddress: who }, data: { linkToken: token() } });
  return NextResponse.json({ username: row.username, linkToken: row.linkToken }, { headers: NO_STORE });
}

async function handleDELETE(req: NextRequest) {
  const who = await caller(req);
  if (!who) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401 });
  await prisma.chatUsername.deleteMany({ where: { walletAddress: who } });
  return NextResponse.json({ username: null, linkToken: null }, { headers: NO_STORE });
}

export const GET = guardUsernameStore('api/chat/username GET', handleGET);
export const PUT = guardUsernameStore('api/chat/username PUT', handlePUT);
export const POST = guardUsernameStore('api/chat/username POST', handlePOST);
export const DELETE = guardUsernameStore('api/chat/username DELETE', handleDELETE);
