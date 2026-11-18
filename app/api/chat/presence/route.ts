import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { safeRedisGet, safeRedisSet } from '@/lib/redis';
import { normalizeAudience, encodePresence, visiblePresence, PRESENCE_TTL_S } from '@/lib/chat/presencePolicy';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/presence
 * G-004: Presence in Redis (TTL 120s), zero PostgreSQL writes.
 * A-025: Presence uses the session address ONLY.
 * A-025: Peer presence is only returned to accepted contacts (403 for non-contacts).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const callerAddress = auth.walletAddress.toLowerCase();

    const body = await req.json().catch(() => ({}));
    const { peerAddress } = body;
    const callerAudience = normalizeAudience(body?.visibility);

    // G-004: presence lives in Redis only (no Postgres writes). The caller's "Last seen" choice
    // travels with every heartbeat. `state`:
    //   active     — a window in the foreground: online now (default, older clients send nothing)
    //   background — a window in the background reading a chat: does not refresh the caller
    //   leaving    — the window went to the background or closed: offline now, last seen = now
    const now = Date.now();
    const state = body?.state === 'background' || body?.state === 'leaving' ? body.state : 'active';
    if (state !== 'background') {
      await safeRedisSet(`presence:${callerAddress}`, encodePresence(now, callerAudience, state === 'leaving' ? 'off' : 'on'), 'EX', PRESENCE_TTL_S);
    }

    // Fetch peer presence if requested
    if (peerAddress && /^0x[a-fA-F0-9]{40}$/.test(peerAddress)) {
      const normalizedPeer = peerAddress.toLowerCase();

      // Verify contact relationship
      // Both sides must have the other as a contact. A one-sided check let
      // anyone add any address to their own list (POST /api/chat/contacts
      // needs no consent) and then watch when that person is online.
      // The answer is cached in Redis for a short while: every open chat asks every 10 s, and
      // each ask was a Postgres query. Yes is kept 120 s, no 30 s, so a new contact shows up
      // quickly and a removed one stops seeing presence within two minutes.
      const pair = [callerAddress, normalizedPeer].sort().join(':');
      const cacheKey = `presence:mutual:${pair}`;
      const cached = await safeRedisGet(cacheKey);
      let isMutual: boolean;
      if (cached === '1' || cached === '0') {
        isMutual = cached === '1';
      } else {
        const mutual = await prisma.chatContact.count({
          where: {
            OR: [
              { owner: callerAddress, peer: normalizedPeer },
              { owner: normalizedPeer, peer: callerAddress },
            ],
          },
        }).catch(() => -1);
        isMutual = mutual >= 2;
        if (mutual >= 0) await safeRedisSet(cacheKey, isMutual ? '1' : '0', 'EX', isMutual ? 120 : 30);
      }

      if (!isMutual) {
        return NextResponse.json(
          { error: 'Forbidden: Can only check presence of accepted contacts' },
          { status: 403 }
        );
      }

      // Check Redis for peer presence
      const peerActiveStr = await safeRedisGet(`presence:${normalizedPeer}`);
      return NextResponse.json(visiblePresence(peerActiveStr, callerAudience, now));
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
