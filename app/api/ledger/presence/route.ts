import { NextRequest, NextResponse } from 'next/server';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const address = new URL(req.url).searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });
  
  const raw = await safeRedisGet(`presence:${address.toLowerCase()}`);
  if (!raw || raw === 'TIMEOUT') {
    return NextResponse.json({ address, status: 'offline', lastSeen: null });
  }
  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ address, status: 'offline', lastSeen: null });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await req.json();
  const { address, status } = body;
  if (!address || !['online', 'away', 'offline'].includes(status)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  
  // Security check: Only the owner can update their presence
  if (address.toLowerCase() !== session.userId.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const data = { address: address.toLowerCase(), status, lastSeen: Date.now() };
  // 90 seconds TTL for presence. If they disconnect, it expires automatically.
  await safeRedisSet(`presence:${address.toLowerCase()}`, JSON.stringify(data), 'EX', 90);
  return NextResponse.json({ ok: true, ...data });
}
