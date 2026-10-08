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
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function resolveCallerAddress(req: NextRequest): Promise<string | null> {
  // Priority 1: address injected by middleware after cryptographic JWT verification — cannot be forged by client
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  // Priority 2: server-side session (e.g. NextAuth cookie — email login)
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  // Priority 3: client-supplied header — trusted for non-sensitive ops (contact requests).
  // Anti-spoofing is enforced by cross-checking the address against the body in POST handlers.
  return null; // Spoofing vector closed
}


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

    if (to === caller) {
      return NextResponse.json({ error: 'Cannot send request to yourself' }, { status: 400 });
    }

    // Check if they are already contacts
    const existing = await (prisma as any).chatContact.findUnique({
      where: { owner_peer: { owner: caller, peer: to } },
    }).catch(() => null);
    if (existing) {
      return NextResponse.json({ ok: true, status: 'ALREADY_CONNECTED' });
    }

    // Upsert the request — if already sent, keep as PENDING (idempotent)
    const existingRequest = await (prisma as any).chatContactRequest.findUnique({
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
      await (prisma as any).chatContactRequest.update({
        where: { fromAddress_toAddress: { fromAddress: caller, toAddress: to } },
        data: { status: 'PENDING', updatedAt: new Date() },
      });
    } else {
      await (prisma as any).chatContactRequest.create({
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
    
    // Import dynamically to avoid top-level issues if needed, or just import at top.
    const { deriveAztecAddress } = await import('@/lib/aztec/zk-identity');
    const aztecCaller = deriveAztecAddress(caller).toLowerCase();

    const requests = await (prisma as any).chatContactRequest.findMany({
      where: dir === 'incoming'
        ? { toAddress: { in: [caller, aztecCaller] }, status: 'PENDING' }
        : { fromAddress: { in: [caller, aztecCaller] }, status: { in: ['PENDING', 'ACCEPTED', 'REJECTED'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

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
  } catch (err) {
    console.error('[ChatContactRequest] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
