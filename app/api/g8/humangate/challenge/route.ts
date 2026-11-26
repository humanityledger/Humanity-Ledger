import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { HUMAN_GATE_TTL_SEC, isMode, issueChallenge } from '@/lib/g8/humanGate';

export const dynamic = 'force-dynamic';

/** GET ?mode=orbit|accessible-rhythm → a sealed, single-use human presence challenge. */
export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(getClientIP(req), { max: 30, windowSec: 60, prefix: 'rl:g8-hg-chal' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
  const m = req.nextUrl.searchParams.get('mode') || 'orbit';
  if (!isMode(m)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  try {
    // Bursts from one network get more work per attempt.
    const { token, payload } = issueChallenge(m, rl.remaining < 10);
    return NextResponse.json(
      { challengeToken: token, seedHex: payload.seedHex, mode: payload.mode, difficulty: payload.difficulty, ttlSec: HUMAN_GATE_TTL_SEC },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'The check is unavailable right now.' }, { status: 503 }); // JWT_SECRET missing: fail closed
  }
}
