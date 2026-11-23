/**
 * POST /api/beta/cusdc/apply { name, email, wallet?, social?, message?, adult: true, contact: true }
 *
 * The request form on /beta (lib/beta/beta-application.ts). Open to anyone, signed in or not. Sends
 * one email to the beta inbox (BETA_REQUESTS_TO, else DEFAULT_BETA_INBOX) with Reply-To set to the
 * person's email, so the operator answers that message with a code. Nothing from the form is saved
 * in the database. JSON only, a hidden field for bots, and a limit per network address.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { DEFAULT_BETA_INBOX, applicationEmail, parseApplication } from '@/lib/beta/beta-application';
import { prismaRequestStore } from '@/lib/beta/cusdc-beta-request-prisma';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const NOT_SENT = 'Your request could not be sent right now. Try again in a few minutes.';

export async function POST(req: NextRequest) {
  // JSON only: a cross-site form cannot send application/json without a preflight.
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'Send JSON.' }, { status: 415, headers: NO_STORE });
  }
  const rl = await checkRateLimit(getClientIP(req), { max: 5, windowSec: 3600, prefix: 'rl:beta-apply' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests from this network. Try again in an hour.' }, { status: 429, headers: NO_STORE });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Fill in the form and try again.' }, { status: 400, headers: NO_STORE });
  }
  const parsed = parseApplication(body);
  // A bot gets the same answer as a person, and nothing is sent.
  if (!parsed.ok && 'bot' in parsed) return NextResponse.json({ sent: true }, { headers: NO_STORE });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400, headers: NO_STORE });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: NOT_SENT }, { status: 503, headers: NO_STORE });
  const signedIn = (await getVerifiedCaller(req).catch(() => null))?.toLowerCase() ?? null;
  const mail = applicationEmail(parsed.app, { signedInWallet: signedIn && /^0x[0-9a-f]{40}$/.test(signedIn) ? signedIn : null, at: new Date() });
  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: `Ledger Chat beta <${process.env.RESEND_FROM_EMAIL || 'noreply@ledgerchat.org'}>`,
      to: process.env.BETA_REQUESTS_TO || DEFAULT_BETA_INBOX,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    if (error) throw new Error(String((error as { message?: string }).message ?? error));
  } catch {
    return NextResponse.json({ error: NOT_SENT }, { status: 503, headers: NO_STORE });
  }
  // Signed in: also keep the wallet as a request, so a place can be reserved for it.
  if (signedIn && /^0x[0-9a-f]{40}$/.test(signedIn)) await prismaRequestStore.create(signedIn, new Date()).catch(() => null);
  return NextResponse.json({ sent: true }, { headers: NO_STORE });
}
