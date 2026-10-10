/**
 * POST /api/chat/contacts/request/[action]
 * action = "accept" | "reject"
 *
 * Body: { requestId: string }
 *
 * On accept:  upserts both directions in ChatContact so both wallets see each other,
 *             marks the request ACCEPTED, creates a notification for the requester.
 * On reject:  marks the request REJECTED (no notification sent — keeps it silent).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { deriveAztecAddress } from '@/lib/aztec/zk-identity';

export const dynamic = 'force-dynamic';

async function resolveCallerAddress(req: NextRequest): Promise<string | null> {
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  return null; // Spoofing vector closed
}


export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const caller = await resolveCallerAddress(req);
    const resolvedParams = await params;
    const action = resolvedParams.action;
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action. Use accept or reject.' }, { status: 400 });
    }

    const { requestId } = await req.json();
    if (!requestId) return NextResponse.json({ error: 'requestId required' }, { status: 400 });

    // Fetch and validate the request belongs to the caller as recipient
    const request = await (prisma as any).chatContactRequest.findUnique({
      where: { id: requestId },
    }).catch(() => null);

    if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    
    const aztecCaller = deriveAztecAddress(caller).toLowerCase();
    if (request.toAddress !== caller && request.toAddress !== aztecCaller) {
      return NextResponse.json({ error: 'Forbidden — you are not the recipient of this request' }, { status: 403 });
    }
    if (request.status !== 'PENDING') {
      return NextResponse.json({ ok: true, status: request.status, message: 'Already resolved' });
    }

    if (action === 'accept') {
      // Create bidirectional contact entries + mark request accepted — atomically
      await prisma.$transaction([
        prisma.chatContact.upsert({
          where: { owner_peer: { owner: caller, peer: request.fromAddress } },
          update: { updatedAt: new Date() },
          create: { owner: caller, peer: request.fromAddress },
        }),
        prisma.chatContact.upsert({
          where: { owner_peer: { owner: request.fromAddress, peer: request.toAddress } },
          update: { updatedAt: new Date() },
          create: { owner: request.fromAddress, peer: request.toAddress },
        }),
        (prisma as any).chatContactRequest.update({
          where: { id: requestId },
          data: { status: 'ACCEPTED', updatedAt: new Date() },
        }),
      ]);

      // Notify the original requester that they were accepted
      const accepterUser = await prisma.user.findFirst({
        where: { walletAddress: caller },
        select: { chatName: true, displayName: true },
      }).catch(() => null);
      const accepterName = accepterUser?.chatName || accepterUser?.displayName || `${caller.slice(0,6)}…${caller.slice(-4)}`;

      const requesterUser = await prisma.user.findFirst({
        where: { walletAddress: request.fromAddress },
        select: { id: true },
      }).catch(() => null);

      if (requesterUser?.id) {
        await prisma.notification.create({
          data: {
            userId: requesterUser.id,
            title: 'Contact Request Accepted',
            message: `${accepterName} accepted your contact request. You can now message each other.`,
            type: 'CONTACT_ACCEPTED',
            actionUrl: `/chat`,
            read: false,
          },
        });
      }

      return NextResponse.json({ ok: true, status: 'ACCEPTED' });
    } else {
      // reject — silent for requester
      await (prisma as any).chatContactRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', updatedAt: new Date() },
      });
      return NextResponse.json({ ok: true, status: 'REJECTED' });
    }
  } catch (err) {
    console.error('[ChatContactRequest] Action error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
