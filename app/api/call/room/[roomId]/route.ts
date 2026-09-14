import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId.toUpperCase();
  const room = await prisma.callRoom.findFirst({
    where: { roomId, isActive: true, expiresAt: { gt: new Date() } },
    select: { roomId: true, isVideo: true, moderatorAddress: true, participants: true, maxParticipants: true, expiresAt: true, passwordHash: true }
  });
  if (!room) return NextResponse.json({ error: 'Room not found or expired' }, { status: 404 });
  return NextResponse.json({
    roomId: room.roomId,
    isVideo: room.isVideo,
    moderatorAddress: room.moderatorAddress,
    participantCount: room.participants.length,
    maxParticipants: room.maxParticipants,
    passwordProtected: !!(room.passwordHash && room.passwordHash.length > 0),
    expiresAt: room.expiresAt.toISOString(),
  });
}