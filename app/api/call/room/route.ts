import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHmac, createHash } from 'crypto';
import { cookies } from 'next/headers';

const ROOM_SECRET = process.env.CALL_ROOM_SECRET || process.env.NEXTAUTH_SECRET || 'ledger-call-secret-change-in-prod';
const MAX_PARTICIPANTS = 20;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const TOKEN_TTL_MS = 30 * 60 * 1000;    // 30 minutes
const MAX_ROOMS_PER_HOUR = 10;

// Rate-limit: in-memory map (resets on server restart, sufficient for call abuse prevention)
const createRateMap = new Map<string, { count: number; resetAt: number }>();
const joinFailMap  = new Map<string, { count: number; resetAt: number; lockedUntil?: number }>();

function hashPassword(password: string): string {
  return createHash('sha256').update(password + ROOM_SECRET).digest('hex');
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0,O,1,I)
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateToken(roomId: string, address: string): string {
  const ts = Date.now();
  const payload = `${roomId}:${address}:${ts}`;
  const sig = createHmac('sha256', ROOM_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyToken(token: string): { roomId: string; address: string; ts: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [roomId, address, tsStr, sig] = parts;
    const payload = `${roomId}:${address}:${tsStr}`;
    const expected = createHmac('sha256', ROOM_SECRET).update(payload).digest('hex');
    if (sig !== expected) return null;
    const ts = parseInt(tsStr, 10);
    if (Date.now() - ts > TOKEN_TTL_MS) return null;
    return { roomId, address, ts };
  } catch { return null; }
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

function checkJoinRateLimit(ip: string): { allowed: boolean; lockedUntil?: number } {
  const now = Date.now();
  const entry = joinFailMap.get(ip);
  if (!entry || now > entry.resetAt) {
    joinFailMap.set(ip, { count: 0, resetAt: now + 300_000 });
    return { allowed: true };
  }
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return { allowed: false, lockedUntil: entry.lockedUntil };
  }
  return { allowed: true };
}

function recordJoinFailure(ip: string): void {
  const now = Date.now();
  const entry = joinFailMap.get(ip) || { count: 0, resetAt: now + 300_000 };
  entry.count++;
  if (entry.count >= 5) entry.lockedUntil = now + 60_000; // 60s lockout
  joinFailMap.set(ip, entry);
}

// ── POST /api/call/room — Create a new call room ────────────────────────────
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

  const roomId = generateRoomId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ROOM_TTL_MS);
  const passwordHash = password ? hashPassword(password) : '';

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
  const token = generateToken(roomId, address);
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

// ── GET /api/call/room?roomId=XXX — Check room exists ──────────────────────
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
