import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { logger } from '@/lib/logger';
import { HUMAN_GATE_COOKIE, HUMAN_GATE_RECEIPT_TTL_SEC, gateCookieOptions, verifyHumanGateSubmission } from '@/lib/g8/humanGate';

export const dynamic = 'force-dynamic';

/** POST one attempt → HttpOnly single-use receipt cookie when the server's own checks pass. */
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIP(req), { max: 20, windowSec: 60, prefix: 'rl:g8-hg-verify' });
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
  const raw = await req.text().catch(() => '');
  if (raw.length > 120_000) return NextResponse.json({ ok: false, error: 'retry' }, { status: 413 });
  let body: any = null;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: 'retry' }, { status: 400 }); }
  let r;
  try { r = await verifyHumanGateSubmission(body); } catch { return NextResponse.json({ ok: false, error: 'The check is unavailable right now.' }, { status: 503 }); }
  if (!r.ok) {
    logger.info({ reason: r.reason }, '[G8:HumanGate] attempt rejected');
    // One generic answer: the reason codes would teach a script what to change.
    return NextResponse.json({ ok: false, error: 'retry' }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.set(HUMAN_GATE_COOKIE, r.receipt, gateCookieOptions(HUMAN_GATE_RECEIPT_TTL_SEC));
  return res;
}
