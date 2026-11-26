/**
 * /api/chat/contacts/request
 *
 * Instagram-style peer-to-peer contact request system.
 *
 * POST  — Send a friend request (fromAddress → toAddress)
 * GET   — List incoming or outgoing requests for the authenticated wallet
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { isMutuallyBlocked, blockedCounterparties } from '@/lib/chat/blockFirewall';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { safeRedisDel } from '@/lib/redis/client';

/** An EVM address or an Aztec address (both are used as contact ids). */
const ADDRESS_RE = /^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export const dynamic = 'force-dynamic';

// The session (revocation-aware), never a client-supplied address.
const resolveCallerAddress = (req: NextRequest) => getVerifiedCaller(req);


// ─── POST /api/chat/contacts/request ─────────────────────────────────────────
// Body: { toAddress: string }
// Creates a PENDING request, then drops a Notification row for the recipient.
export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCallerAddress(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { toAddress } = await req.json();
    if (!toAddress || typeof toAddress !== 'string') {
      return NextResponse.json({ error: 'toAddress is required' }, { status: 400 });
    }

    const to = toAddress.toLowerCase().trim();
    // Requests (and the notification each one creates) go to real addresses
    // only, and one account cannot flood others with them.
    if (!ADDRESS_RE.test(to)) {
      return NextResponse.json({ error: 'toAddress must be a wallet address' }, { status: 400 });
    }
    const rl = await checkRateLimit(caller, { max: 30, windowSec: 3600, prefix: 'rl:contact-req' });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many contact requests. Try again later.' }, { status: 429 });
    }

    if (to === caller) {
      return NextResponse.json({ error: 'Cannot send request to yourself' }, { status: 400 });
    }
    // A block in either direction: no request row, no notification, no hint of who blocked.
    if (await isMutuallyBlocked(caller, to)) {
      return NextResponse.json({ error: 'Cannot send contact request' }, { status: 403 });
    }

    // Check if they are already contacts
    const existing = await prisma.chatContact.findUnique({
      where: { owner_peer: { owner: caller, peer: to } },
    }).catch(() => null);
    if (existing) {
      return NextResponse.json({ ok: true, status: 'ALREADY_CONNECTED' });
    }

    // Upsert the request — if already sent, keep as PENDING (idempotent)
    const existingRequest = await prisma.chatContactRequest.findUnique({
      where: { fromAddress_toAddress: { fromAddress: caller, toAddress: to } },
    }).catch(() => null);

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return NextResponse.json({ ok: true, status: 'ALREADY_PENDING' });
      }
      if (existingRequest.status === 'ACCEPTED') {
        return NextResponse.json({ ok: true, status: 'ALREADY_CONNECTED' });
      }
      // Was rejected — allow re-send after 24h
      const hoursSinceRejection = (Date.now() - new Date(existingRequest.updatedAt).getTime()) / 3_600_000;
      if (hoursSinceRejection < 24) {
        return NextResponse.json({ error: 'Request was declined. You can try again after 24 hours.' }, { status: 429 });
      }
      // Update back to PENDING
      await prisma.chatContactRequest.update({
        where: { fromAddress_toAddress: { fromAddress: caller, toAddress: to } },
        data: { status: 'PENDING', updatedAt: new Date() },
      });
    } else {
      await prisma.chatContactRequest.create({
        data: { fromAddress: caller, toAddress: to, status: 'PENDING' },
      });
    }

    // Look up the caller's display info for the notification message
    const callerUser = await prisma.user.findFirst({
      where: { walletAddress: caller },
      select: { chatName: true, displayName: true, walletAddress: true },
    }).catch(() => null);

    const callerName = callerUser?.chatName
      || callerUser?.displayName
      || `${caller.slice(0, 6)}...${caller.slice(-4)}`;

    // Resolve the recipient's User.id to attach the notification
    const recipientUser = await prisma.user.findFirst({
      where: { walletAddress: to },
      select: { id: true },
    }).catch(() => null);

    if (recipientUser?.id) {
      await prisma.notification.create({
        data: {
          userId: recipientUser.id,
          title: 'New Contact Request',
          message: `${callerName} wants to connect with you.`,
          type: 'CONTACT_REQUEST',
          actionUrl: `/chat?requests=1`,
          read: false,
        },
      });
      await safeRedisDel(`notif:inbox:v1:${to}`);
    }

    return NextResponse.json({ ok: true, status: 'SENT' });
  } catch (err) {
    console.error('[ChatContactRequest] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET /api/chat/contacts/request?direction=incoming|outgoing ──────────────
export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCallerAddress(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dir = new URL(req.url).searchParams.get('direction') ?? 'incoming';
    
    // Requests are keyed by the canonical session EVM address only (the old
    // derived "Aztec address" was not a real Aztec address; CLAUDE.md §3).
    const hidden = await blockedCounterparties(caller);
    const allRequests = await prisma.chatContactRequest.findMany({
      where: dir === 'incoming'
        ? { toAddress: caller, status: 'PENDING' }
        : { fromAddress: caller, status: { in: ['PENDING', 'ACCEPTED', 'REJECTED'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const requests = allRequests.filter(r => !hidden.has(dir === 'incoming' ? r.fromAddress : r.toAddress));

    // Enrich with user profiles
    const addresses = dir === 'incoming'
      ? requests.map((r: any) => r.fromAddress)
      : requests.map((r: any) => r.toAddress);

    const users = await prisma.user.findMany({
      where: { walletAddress: { in: addresses } },
      select: { walletAddress: true, chatName: true, displayName: true, avatarUrl: true, isZkVerified: true, tier: true },
    });
    const userMap = Object.fromEntries(users.map((u: any) => [u.walletAddress.toLowerCase(), u]));

    const enriched = requests.map((r: any) => {
      const addr = dir === 'incoming' ? r.fromAddress : r.toAddress;
      const u = userMap[addr.toLowerCase()] || {};
      return {
        id: r.id,
        fromAddress: r.fromAddress,
        toAddress: r.toAddress,
        status: r.status,
        createdAt: r.createdAt,
        user: {
          address: addr,
          nickname: u.chatName || u.displayName || `${addr.slice(0,6)}…${addr.slice(-4)}`,
          avatarUrl: u.avatarUrl || null,
          isVerified: u.isZkVerified || false,
          tier: u.tier || 'EXPLORER',
        },
      };
    });

    return NextResponse.json({ requests: enriched });
  } catch (err: any) {
    console.warn('[ChatContactRequest] GET: Database unavailable, returning empty requests list.');
    return NextResponse.json({ requests: [] });
  }
}
