import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

function getSessionAddress(req: NextRequest): string | null {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get('system_handshake')?.value;
    if (session) return session.toLowerCase();
    const header = req.headers.get('x-wallet-address');
    return header ? header.toLowerCase() : null;
  } catch { return null; }
}

/**
 * POST /api/call/room/[roomId]/moderate
 * Moderator-only actions: kick, transfer, end-for-all
 * Body: { action: 'kick' | 'transfer' | 'end', targetAddress?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const address = getSessionAddress(req);
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roomId = params.roomId.toUpperCase();

  const room = await prisma.callRoom.findFirst({
    where: { roomId, isActive: true, expiresAt: { gt: new Date() } }
  });

  if (!room) {
    return NextResponse.json({ error: 'Room not found or expired' }, { status: 404 });
  }

  if (room.moderatorAddress.toLowerCase() !== address) {
    return NextResponse.json({ error: 'Only the moderator can perform this action' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const targetAddress = typeof body.targetAddress === 'string' ? body.targetAddress.toLowerCase() : '';

  if (action === 'kick') {
    if (!targetAddress || targetAddress === address) {
      return NextResponse.json({ error: 'Invalid target address' }, { status: 400 });
    }
    const updatedParticipants = room.participants.filter((p: string) => p !== targetAddress);
    await prisma.callRoom.update({
      where: { roomId },
      data: { participants: updatedParticipants, lastActivityAt: new Date() }
    });
    await prisma.callRoomToken.deleteMany({ where: { roomId, address: targetAddress } }).catch(() => {});
    return NextResponse.json({ success: true, action: 'kicked', targetAddress, participants: updatedParticipants });
  }

  if (action === 'transfer') {
    if (!targetAddress || targetAddress === address) {
      return NextResponse.json({ error: 'Invalid target address' }, { status: 400 });
    }
    if (!room.participants.includes(targetAddress)) {
      return NextResponse.json({ error: 'Target is not in the room' }, { status: 400 });
    }
    await prisma.callRoom.update({
      where: { roomId },
      data: { moderatorAddress: targetAddress, lastActivityAt: new Date() }
    });
    return NextResponse.json({ success: true, action: 'transferred', newModerator: targetAddress });
  }

  if (action === 'end') {
    await prisma.callRoom.update({ where: { roomId }, data: { isActive: false, lastActivityAt: new Date() } });
    await prisma.callRoomToken.deleteMany({ where: { roomId } }).catch(() => {});
    return NextResponse.json({ success: true, action: 'ended' });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}