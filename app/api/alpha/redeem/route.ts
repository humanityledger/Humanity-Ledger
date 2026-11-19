/**
 * POST /api/alpha/redeem { code, accept: { terms, risks, eligibility }, termsSha256 } — the
 * signed-in wallet redeems a closed alpha invitation.
 *
 * Package 4: no code is redeemed while no signed version of the terms is recorded
 * (ALPHA_TERMS_VERSION, ALPHA_TERMS_SHA256, OD-8). The three boxes are separate and each must be
 * true; termsSha256 must be the hash of the signed text the tester was shown. Each acceptance is
 * stored with its time and that hash.
 *
 * Signed session only (getVerifiedCaller); rate limited per wallet. One answer for every bad code
 * (unknown, used, revoked, expired), so the endpoint does not tell which codes exist. At most
 * MAX_TESTERS (OD-4) members. Nothing about the request (IP, user agent) is stored.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { hashInviteCode, MAX_TESTERS, normalizeInviteCode } from '@/lib/alpha/invites';
import { distributionDecision, type ClosedAlphaEntry } from '@/lib/alpha/gate';
import { acceptanceProblem, retainUntil } from '@/lib/alpha/rules.mjs';
import record from '../../../../deployments/aztec-mainnet.json';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const BAD = 'This invitation code does not work. Check it, or ask for a new one.';

export async function POST(req: NextRequest) {
  const who = (await getVerifiedCaller(req))?.toLowerCase() ?? null;
  if (!who || !/^0x[0-9a-f]{40}$/.test(who)) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401, headers: NO_STORE });
  // Package 3: no invitation is redeemed while nobody is recorded as the distributor of HLC.
  if (!distributionDecision((record as { closedAlpha?: ClosedAlphaEntry }).closedAlpha).ok) {
    return NextResponse.json({ error: 'The closed alpha is not open.' }, { status: 503, headers: NO_STORE });
  }
  const pepper = process.env.ALPHA_INVITE_PEPPER || '';
  if (pepper.length < 32) return NextResponse.json({ error: 'The closed alpha is not open.' }, { status: 503, headers: NO_STORE });
  const rl = await checkRateLimit(who, { max: 5, windowSec: 3600, prefix: 'rl:alpha-redeem' });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts. Try again in an hour.' }, { status: 429, headers: NO_STORE });
  let body: { code?: unknown; accept?: unknown; termsSha256?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: BAD }, { status: 400, headers: NO_STORE }); }
  const terms = { version: process.env.ALPHA_TERMS_VERSION || '', sha256: (process.env.ALPHA_TERMS_SHA256 || '').toLowerCase() };
  const notAccepted = acceptanceProblem(body, terms);
  if (notAccepted) return NextResponse.json({ error: notAccepted }, { status: terms.version ? 400 : 503, headers: NO_STORE });
  const code = normalizeInviteCode(typeof body.code === 'string' ? body.code.slice(0, 40) : '');
  if (!code) return NextResponse.json({ error: BAD }, { status: 400, headers: NO_STORE });

  const existing = await prisma.alphaMember.findUnique({ where: { walletAddress: who } });
  if (existing) {
    return NextResponse.json(existing.revokedAt ? { error: 'This account’s closed alpha access was revoked.' } : { member: true }, { status: existing.revokedAt ? 403 : 200, headers: NO_STORE });
  }
  const codeHash = hashInviteCode(code, pepper);
  try {
    const member = await prisma.$transaction(async (tx) => {
      // R2-2: one redemption at a time, so two codes redeemed together cannot pass the 50 cap.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72707370)`;
      const count = await tx.alphaMember.count();
      if (count >= MAX_TESTERS) return 'full' as const;
      // Claim the invitation atomically: only an unused, unrevoked, unexpired code matches.
      const claimed = await tx.alphaInvite.updateMany({
        where: { codeHash, redeemedBy: null, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        data: { redeemedBy: who, redeemedAt: new Date() },
      });
      if (claimed.count !== 1) return null;
      const invite = await tx.alphaInvite.findUnique({ where: { codeHash } });
      const at = new Date();
      return tx.alphaMember.create({
        data: {
          walletAddress: who,
          inviteId: invite!.id,
          termsAcceptedAt: at,
          termsSha256: terms.sha256,
          risksAcceptedAt: at,
          risksSha256: terms.sha256,
          eligibilityAcceptedAt: at,
          eligibilitySha256: terms.sha256,
          retainUntil: retainUntil((record as { closedAlpha?: { until?: string | null } }).closedAlpha?.until ?? null),
        },
      });
    });
    if (member === 'full') return NextResponse.json({ error: 'The closed alpha is full.' }, { status: 409, headers: NO_STORE });
    if (!member) return NextResponse.json({ error: BAD }, { status: 400, headers: NO_STORE });
    return NextResponse.json({ member: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: BAD }, { status: 400, headers: NO_STORE });
  }
}
