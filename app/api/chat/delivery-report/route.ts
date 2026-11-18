/**
 * POST /api/chat/delivery-report — a message-delivery problem seen in a browser, written to the
 * server log as one line so it can be read in Railway (18 November 2026: messages did not arrive
 * and no log anywhere showed it). The body holds the kind of event, the error text with ids
 * removed and the browser family. Nothing else is accepted or stored: no message, no address,
 * no inbox id. Signed-in accounts only, 20 reports a minute.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { redactXmtpError } from '@/lib/xmtp/syncErrors';

export const dynamic = 'force-dynamic';

const KINDS = new Set(['send_failed', 'publish_pending', 'publish_retrying', 'publish_gave_up', 'group_failed', 'client_failed', 'stream_restarted']);
const BROWSERS = new Set(['chrome', 'safari', 'firefox', 'edge', 'other']);

export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return new NextResponse(null, { status: 204 });
  const rl = await checkRateLimit(auth.walletAddress.toLowerCase(), { max: 20, windowSec: 60, prefix: 'rl:delivery-report' });
  if (!rl.allowed) return new NextResponse(null, { status: 204 });
  const body = await req.json().catch(() => ({}));
  const kind = KINDS.has(body?.kind) ? body.kind : 'other';
  const browser = BROWSERS.has(body?.browser) ? body.browser : 'other';
  const error = redactXmtpError(typeof body?.error === 'string' ? body.error : 'unknown');
  const env = body?.env === 'dev' || body?.env === 'local' ? body.env : 'production';
  console.warn(`[delivery] kind=${kind} browser=${browser}${body?.mobile ? '/mobile' : ''} xmtp=${env} error="${error.replace(/"/g, "'")}"`);
  return new NextResponse(null, { status: 204 });
}
