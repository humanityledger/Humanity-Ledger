import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { hashRoomPassword, generateCrockfordRoomId, generateJoinToken } from '@/lib/utils/roomCrypto';

const ROOM_SECRET = process.env.CALL_ROOM_SECRET || process.env.NEXTAUTH_SECRET || 'ledger-call-secret-change-in-prod';
const MAX_PARTICIPANTS = 20;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours (longer than room TTL to avoid mid-call kicks)
const MAX_ROOMS_PER_HOUR = 10;

// Rate-limit: in-memory map (resets on server restart, sufficient for call abuse prevention)
const createRateMap = new Map<string, { count: number; resetAt: number }>();

function getSessionAddress(req: NextRequest): string | null {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get('system_handshake')?.value;
    if (session) return session.toLowerCase();
    const header = req.headers.get('x-wallet-address');
    return header ? header.toLowerCase() : null;
  } catch { return null; }
}

function checkCreateRateLimit(address: string): boolean {
  const now = Date.now();
  const entry = createRateMap.get(address);
  if (!entry || now > entry.resetAt) {
    createRateMap.set(address, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= MAX_ROOMS_PER_HOUR) return false;
  entry.count++;
  return true;
}

// ── POST /api/call/room — Create a new call room ──
export async function POST(req: NextRequest) {
  const address = getSessionAddress(req);
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Input validation
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  const isVideo  = body.isVideo !== false;

  if (password.length > 0 && (password.length < 4 || password.length > 64)) {
    return NextResponse.json({ error: 'Password must be 4–64 characters' }, { status: 400 });
  }

  // Rate limit
  if (!checkCreateRateLimit(address)) {
    return NextResponse.json({ error: 'Too many rooms created. Try again later.' }, { status: 429 });
  }

  // Deactivate expired rooms by this host
  await prisma.callRoom.updateMany({
    where: { hostAddress: address, expiresAt: { lt: new Date() } },
    data: { isActive: false }
  }).catch(() => {});

  const roomId = generateCrockfordRoomId(8);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ROOM_TTL_MS);
  const passwordHash = password ? hashRoomPassword(password) : '';

  const room = await prisma.callRoom.create({
    data: {
      roomId,
      passwordHash,
      hostAddress: address,
      moderatorAddress: address,
      isVideo,
      maxParticipants: MAX_PARTICIPANTS,
      participants: [address],
      expiresAt,
      lastActivityAt: now,
      isActive: true,
    }
  });

  // Issue a host join token
  const token = generateJoinToken(roomId, address, ROOM_SECRET);
  const tokenExpiry = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.callRoomToken.create({
    data: { roomId, address, token, expiresAt: tokenExpiry }
  });

  return NextResponse.json({
    success: true,
    roomId: room.roomId,
    joinToken: token,
    isVideo: room.isVideo,
    moderatorAddress: room.moderatorAddress,
    expiresAt: room.expiresAt.toISOString(),
  });
}

// ── GET /api/call/room?roomId=XXX — Check room exists ──
export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId')?.toUpperCase();
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

  const room = await prisma.callRoom.findFirst({
    where: { roomId, isActive: true, expiresAt: { gt: new Date() } },
    select: {
      roomId: true, isVideo: true, moderatorAddress: true,
      participants: true, maxParticipants: true, expiresAt: true,
      passwordHash: true
    }
  });

  if (!room) return NextResponse.json({ error: 'Room not found or expired' }, { status: 404 });

  return NextResponse.json({
    roomId: room.roomId,
    isVideo: room.isVideo,
    moderatorAddress: room.moderatorAddress,
    participantCount: room.participants.length,
    maxParticipants: room.maxParticipants,
    hasPassword: room.passwordHash !== '',
    expiresAt: room.expiresAt.toISOString(),
  });
}
