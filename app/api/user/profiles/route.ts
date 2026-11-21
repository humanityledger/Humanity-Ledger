import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADDRESS = /^0x[0-9a-f]{40}$/;
const MAX = 100;

/**
 * POST /api/user/profiles  { addresses: string[] }  →  { profiles: { [address]: { displayName, avatarUrl } } }
 *
 * The public profile (name and photo) of the people in your chat list, in one request
 * (lib/chat/peerProfiles.ts). It returns only what GET /api/user/profile already shows to any
 * signed-in person: display name and photo. Like /api/user/search it needs a session, so the
 * list of users cannot be read from outside. Addresses without a profile are left out.
 */
export async function POST(req: NextRequest) {
  const sessionAddress = req.headers.get('x-verified-session-address');
  if (!sessionAddress) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const raw = (body as { addresses?: unknown })?.addresses;
  if (!Array.isArray(raw)) return NextResponse.json({ error: 'addresses must be an array' }, { status: 400 });
  const addresses = [...new Set(raw.filter((a): a is string => typeof a === 'string').map((a) => a.trim().toLowerCase()).filter((a) => ADDRESS.test(a)))].slice(0, MAX);
  if (!addresses.length) return NextResponse.json({ profiles: {} });

  try {
    const users = await prisma.user.findMany({
      where: { OR: addresses.map((a) => ({ walletAddress: { equals: a, mode: 'insensitive' as const } })) },
      select: { walletAddress: true, displayName: true, chatName: true, avatarUrl: true },
      take: MAX,
    });
    const profiles: Record<string, { displayName: string | null; avatarUrl: string | null }> = {};
    for (const u of users) {
      const a = (u.walletAddress || '').toLowerCase();
      if (!a) continue;
      profiles[a] = { displayName: u.displayName || u.chatName || null, avatarUrl: u.avatarUrl || null };
    }
    return NextResponse.json({ profiles }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch {
    // The caller keeps what it already shows when this fails.
    return NextResponse.json({ error: 'Profiles are not available right now' }, { status: 503 });
  }
}
