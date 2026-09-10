import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHmac, createHash } from 'crypto';
import { cookies } from 'next/headers';

const ROOM_SECRET = process.env.CALL_ROOM_SECRET || process.env.NEXTAUTH_SECRET || 'ledger-call-secret-change-in-prod';
const TOKEN_TTL_MS = 30 * 60 * 1000;

function hashPassword(password: string): string {
  return createHash('sha256').update(password + ROOM_SECRET).digest('hex');
}

function generateToken(roomId: string, address: string): string {
  const ts = Date.now();
  const payload = `${roomId}:${address}:${ts}`;
  const sig = createHmac('sha256', ROOM_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function getSessionAddress(req: NextRequest): string | null {
  try {
    const cookieStore = cookies();
    const session = cookieStore.get('system_handshake')?.value;
    if (session) return session.toLowerCase();
    const header = req.headers.get('x-wallet-address');
    return header ? header.toLowerCase() : null;
  } catch { return null; }
}

// Rate-limit tracker for failed join attempts per IP
const joinFailMap = new Map<string, { count: number; resetAt: number; lockedUntil?: number }>();
function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}
function checkJoinRateLimit(ip: string): { allowed: boolean; lockedUntil?: number } {
  const now = Date.now();
  const entry = joinFailMap.get(ip);
  if (!entry || now > entry.resetAt) return { allowed: true };
  if (entry.lockedUntil && now < entry.lockedUntil) return { allowed: false, lockedUntil: entry.lockedUntil };
  return { allowed: true };
}
function recordJoinFailure(ip: string): void {
  const now = Date.now();
  const entry = joinFailMap.get(ip) || { count: 0, resetAt: now + 300_000 };
  entry.count++;
  if (entry.count >= 5) entry.lockedUntil = now + 60_000;
  joinFailMap.set(ip, entry);
}

// ── POST /api/call/room/[roomId]/join — Validate password & issue join token ─
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const address = getSessionAddress(req);
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roomId = params.roomId.toUpperCase();
  const ip = getIp(req);

  // Rate limit
  const rl = checkJoinRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json({
      error: 'Too many failed attempts. Please wait before trying again.',
      retryAfter: Math.ceil(((rl.lockedUntil ?? 0) - Date.now()) / 1000)
    }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const password = typeof body.password === 'string' ? body.password : '';

  const room = await prisma.callRoom.findFirst({
    where: { roomId, isActive: true, expiresAt: { gt: new Date() } }
  });

  if (!room) {
    return NextResponse.json({ error: 'Room not found or expired' }, { status: 404 });
  }

  // Validate participant count
  if (room.participants.length >= room.maxParticipants) {
    return NextResponse.json({ error: 'Room is full' }, { status: 403 });
  }

  // Validate password (if room has one)
  if (room.passwordHash) {
    const hashed = hashPassword(password);
    if (hashed !== room.passwordHash) {
      recordJoinFailure(ip);
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
    }
  }

  // Issue join token
  const token = generateToken(roomId, address);
  const tokenExpiry = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.callRoomToken.create({
    data: { roomId, address, token, expiresAt: tokenExpiry }
  });

  // Add participant to room
  const updatedParticipants = Array.from(new Set([...room.participants, address]));
  await prisma.callRoom.update({
    where: { roomId },
    data: { participants: updatedParticipants, lastActivityAt: new Date() }
  });

  return NextResponse.json({
    success: true,
    joinToken: token,
    roomId: room.roomId,
    isVideo: room.isVideo,
    moderatorAddress: room.moderatorAddress,
    hostAddress: room.hostAddress,
    participants: updatedParticipants,
    expiresAt: room.expiresAt.toISOString(),
  });
}

// ── DELETE /api/call/room/[roomId]/join — Leave the room ───────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const address = getSessionAddress(req);
  if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roomId = params.roomId.toUpperCase();
  const room = await prisma.callRoom.findFirst({ where: { roomId, isActive: true } });
  if (!room) return NextResponse.json({ success: true }); // idempotent

  const updatedParticipants = room.participants.filter(p => p !== address);
  let newModerator = room.moderatorAddress;

  // If moderator is leaving, transfer to next participant (or deactivate if empty)
  if (room.moderatorAddress === address && updatedParticipants.length > 0) {
    newModerator = updatedParticipants[0];
  }

  if (updatedParticipants.length === 0) {
    // Last person left — deactivate room
    await prisma.callRoom.update({ where: { roomId }, data: { isActive: false } });
  } else {
    await prisma.callRoom.update({
      where: { roomId },
      data: { participants: updatedParticipants, moderatorAddress: newModerator, lastActivityAt: new Date() }
    });
  }

  return NextResponse.json({ success: true, newModerator });
}
