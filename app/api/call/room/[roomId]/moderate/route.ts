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

// ── POST /api/call/room/[roomId]/moderate — Transfer moderator or kick user ─
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const address = getSessionAddress(req);
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roomId = params.roomId.toUpperCase();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const targetAddress = typeof body.targetAddress === 'string' ? body.targetAddress.toLowerCase() : '';

  if (!action || !targetAddress) {
    return NextResponse.json({ error: 'Action and targetAddress required' }, { status: 400 });
  }

  // Find the active room
  const room = await prisma.callRoom.findFirst({
    where: { roomId, isActive: true, expiresAt: { gt: new Date() } }
  });

  if (!room) {
    return NextResponse.json({ error: 'Room not found or expired' }, { status: 404 });
  }

  // Security: MUST be the current moderator to perform actions
  if (room.moderatorAddress !== address) {
    return NextResponse.json({ error: 'Only the moderator can perform this action' }, { status: 403 });
  }

  // Security: target must actually be in the room
  if (!room.participants.includes(targetAddress)) {
    return NextResponse.json({ error: 'Target user is not in the room' }, { status: 400 });
  }

  if (action === 'transfer') {
    // Cannot transfer to yourself
    if (targetAddress === address) {
      return NextResponse.json({ error: 'You are already the moderator' }, { status: 400 });
    }
    
    await prisma.callRoom.update({
      where: { roomId },
      data: { moderatorAddress: targetAddress, lastActivityAt: new Date() }
    });
    
    return NextResponse.json({ success: true, newModerator: targetAddress });
  } 
  
  else if (action === 'kick') {
    // Cannot kick yourself (use /leave for that)
    if (targetAddress === address) {
      return NextResponse.json({ error: 'Cannot kick yourself' }, { status: 400 });
    }

    const updatedParticipants = room.participants.filter(p => p !== targetAddress);
    
    await prisma.callRoom.update({
      where: { roomId },
      data: { participants: updatedParticipants, lastActivityAt: new Date() }
    });

    return NextResponse.json({ success: true, kickedAddress: targetAddress });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
