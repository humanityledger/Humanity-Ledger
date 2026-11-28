import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { welcomeQueue } from '@/lib/communities/welcome-queue';

/**
 * Encrypted-channel access signal for MLS communities (lib/communities/welcome-queue.ts).
 *
 *   POST { communityId, done? }  a member whose device is not in the channel's group yet says so
 *                                (done: true clears it once access arrives).
 *   GET                          communities of the caller where another member is waiting.
 *
 * Only identities from the verified session are used; no post content ever reaches this route.
 */
export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

async function isMember(communityId: string, wallet: string): Promise<boolean> {
  const c = await (prisma as any).community.findUnique({ where: { id: communityId }, select: { ownerAddress: true, communityMls: true } });
  if (!c || c.communityMls !== true) return false;
  if (String(c.ownerAddress || '').toLowerCase() === wallet) return true;
  const m = await (prisma as any).communityMember.findUnique({ where: { communityId_walletAddress: { communityId, walletAddress: wallet } } });
  return !!m;
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rl = await checkRateLimit(caller, { max: 40, windowSec: 60, prefix: 'community-welcome' });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Wait a moment.', code: 'RATE_LIMITED' }, { status: 429 });
    const body = await req.json().catch(() => ({}));
    const communityId = typeof body?.communityId === 'string' ? body.communityId : '';
    if (!ID.test(communityId)) return NextResponse.json({ error: 'Invalid community.' }, { status: 400 });
    if (body?.done === true) {
      welcomeQueue.clear(communityId, caller);
      return NextResponse.json({ ok: true });
    }
    if (!(await isMember(communityId, caller))) return NextResponse.json({ error: 'Not a member.' }, { status: 403 });
    welcomeQueue.add(communityId, caller);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not register the request.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Nothing waiting anywhere: answer without touching the database.
    if (welcomeQueue.size === 0) return NextResponse.json({ pending: [] });
    const [memberships, owned] = await Promise.all([
      (prisma as any).communityMember.findMany({ where: { walletAddress: caller }, select: { communityId: true }, take: 500 }),
      (prisma as any).community.findMany({ where: { ownerAddress: { equals: caller, mode: 'insensitive' } }, select: { id: true }, take: 500 }),
    ]);
    const mine = new Set<string>([
      ...memberships.map((m: { communityId: string }) => m.communityId),
      ...owned.map((c: { id: string }) => c.id),
    ]);
    return NextResponse.json({ pending: welcomeQueue.pendingFor(mine, caller) });
  } catch {
    return NextResponse.json({ pending: [] });
  }
}
