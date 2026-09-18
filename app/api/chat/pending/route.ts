import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { deriveAztecAddress } from '@/lib/aztec/zk-identity';

export const dynamic = 'force-dynamic';

/**
 * Resolve the authenticated address from session OR x-web3-address header fallback.
 * This allows WalletConnect-only users (no server session cookie) to read their own
 * pending messages immediately after connecting their wallet.
 */
async function resolveUserId(req: NextRequest, queryAddress: string | null): Promise<string | null> {
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();

  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  
  const web3 = req.headers.get('x-web3-address');
  if (web3) return web3.toLowerCase();
  
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address')?.toLowerCase() ?? null;

    const userId = await resolveUserId(req, address);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!address || address !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const aztecAddr = deriveAztecAddress(address).toLowerCase();

    const pending = await prisma.pendingChatMessage.findMany({
      where: {
        OR: [
          { sender: address },
          { recipient: address },
          { sender: aztecAddr },
          { recipient: aztecAddr }
        ]
      },
      orderBy: { timestamp: 'asc' }
    });

    return NextResponse.json({ pending });
  } catch (error) {
    console.error('[Pending Chat] Error fetching:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sender, recipient, content } = await req.json();

    if (!sender || !recipient || !content) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Validate address formats (EVM or Aztec)
    const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
    const AZTEC_ADDR_RE = /^0x[a-fA-F0-9]{64}$/;
    if (!ETH_ADDR_RE.test(sender) && !AZTEC_ADDR_RE.test(sender)) {
      return NextResponse.json({ error: 'Invalid sender address format' }, { status: 400 });
    }
    if (!ETH_ADDR_RE.test(recipient) && !AZTEC_ADDR_RE.test(recipient)) {
      return NextResponse.json({ error: 'Invalid recipient address format' }, { status: 400 });
    }

    // Content length guard — prevent storage exhaustion attacks
    if (typeof content !== 'string' || content.length > 4096) {
      return NextResponse.json({ error: 'Content too long (max 4096 chars)' }, { status: 400 });
    }

    const userId = await resolveUserId(req, sender);
    if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const aztecUserId = deriveAztecAddress(userId).toLowerCase();
    const senderLower = sender.toLowerCase();
    if (senderLower !== userId.toLowerCase() && senderLower !== aztecUserId) {
       return NextResponse.json({ error: 'Forbidden: You cannot spoof the sender address' }, { status: 403 });
    }

    const pending = await prisma.pendingChatMessage.create({
      data: {
        sender: senderLower,
        recipient: recipient.toLowerCase(),
        content
      }
    });

    return NextResponse.json({ success: true, pending });
  } catch (error) {
    console.error('[Pending Chat] Error saving:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address')?.toLowerCase() ?? null;

    const peer = searchParams.get('peer')?.toLowerCase() ?? null;

    const userId = await resolveUserId(req, address);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!address || address !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const aztecAddr = deriveAztecAddress(address).toLowerCase();
    
    // [SECURITY & DATA INTEGRITY FIX] Only delete messages from the specific peer we just loaded.
    // If peer is missing, return error to prevent accidental wipe of all pending messages.
    if (!peer) {
      return NextResponse.json({ error: 'Missing peer parameter' }, { status: 400 });
    }

    await prisma.pendingChatMessage.deleteMany({
      where: { 
        OR: [
          { recipient: address }, 
          { recipient: aztecAddr }
        ],
        sender: peer
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Pending Chat] Error deleting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
