/**
 * /api/beta/cusdc/status: the signed-in wallet's place in the closed cUSDC beta.
 *   GET   { wallet, open, reasons, member, active, access, accessReasons, visibility, capacity, remaining, notice: { version, text } }
 *   POST  { notice: true, noticeVersion }  records that the member confirmed the current notice
 *
 * `access` is true only when the beta is open and this wallet is an active member who confirmed
 * the current notice (lib/beta/cusdc-beta.ts). The client shows cUSDC only on access: true, and
 * CUSDC_GATES stay untouched. Signed session only; stores the confirmation time and version only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { parseAgreementCaps } from '@/lib/aztec/wallet/config';
import {
  BETA_NOTICE, BETA_NOTICE_VERSION, betaCapacity, cusdcBetaDecision, cusdcBetaEntry, cusdcBetaProgram, cusdcBetaVisibility, cusdcCap, recordedCusdc,
} from '@/lib/beta/cusdc-beta';
import { confirmBetaNotice, memberState, remainingPlaces } from '@/lib/beta/cusdc-beta-store';
import type { MemberState } from '@/lib/beta/cusdc-beta';
import { prismaBetaStore } from '@/lib/beta/cusdc-beta-prisma';
import record from '../../../../../deployments/aztec-mainnet.json';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

async function who(req: NextRequest) {
  const a = (await getVerifiedCaller(req))?.toLowerCase() ?? null;
  return a && /^0x[0-9a-f]{40}$/.test(a) ? a : null;
}

function programInput(now: Date) {
  const entry = cusdcBetaEntry(record);
  const cusdc = recordedCusdc(record);
  let caps: Readonly<Record<string, bigint>> = {};
  try {
    caps = parseAgreementCaps(JSON.parse(process.env.NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS || 'null'));
  } catch {
    caps = {};
  }
  return { entry, cusdc, cap: cusdcCap(caps, cusdc), now };
}

export async function GET(req: NextRequest) {
  const w = await who(req);
  if (!w) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401, headers: NO_STORE });
  const input = programInput(new Date());
  const program = cusdcBetaProgram(input);
  let member: MemberState | null = null;
  let members: number | null = null;
  try {
    [member, members] = await Promise.all([
      prismaBetaStore.findMember(w).then(memberState),
      // Only the capacity pill needs this; without it the page shows no count.
      prismaBetaStore.countMembers().catch(() => null),
    ]);
  } catch {
    // Fail-closed: no database answer means no access.
    return NextResponse.json({ error: 'The beta status is not available right now.' }, { status: 503, headers: NO_STORE });
  }
  const access = cusdcBetaDecision({ ...input, member });
  const capacity = betaCapacity(input.entry);
  return NextResponse.json(
    {
      // The signed-in wallet, so /beta shows which account joins.
      wallet: w,
      open: program.ok,
      reasons: program.ok ? [] : program.reasons,
      member: !!member,
      active: !!member?.active,
      access: access.ok,
      accessReasons: access.ok ? [] : access.reasons,
      // send | exits | hidden: a revoked member or a paused beta keeps the balance visible (exits).
      visibility: cusdcBetaVisibility({ ...input, member }),
      capacity,
      remaining: remainingPlaces(capacity, members),
      notice: { version: BETA_NOTICE_VERSION, text: BETA_NOTICE },
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: NextRequest) {
  const w = await who(req);
  if (!w) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401, headers: NO_STORE });
  const body = await req.json().catch(() => ({}));
  try {
    const r = await confirmBetaNotice(prismaBetaStore, { wallet: w, notice: body?.notice, noticeVersion: body?.noticeVersion, now: new Date() });
    return NextResponse.json(r.body, { status: r.status, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'The beta status is not available right now.' }, { status: 503, headers: NO_STORE });
  }
}
