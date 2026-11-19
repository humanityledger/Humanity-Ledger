/**
 * GET /api/alpha/gate?classId=0x… — may the signed-in wallet OPEN an agreement of this class on
 * Aztec Alpha now? It applies lib/alpha/gate.ts closedAlphaDecision with the record
 * (closedAlpha.enabled, until, classes, recorded deployments) and the caller's membership.
 * Package 7 (internal review 2, finding R2-1): until now no opening path asked it.
 * Exits (claim, refund, withdraw, cancel) and accepting an invitation never ask: they settle
 * agreements that already exist. Signed session only; answers { ok, reasons }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { closedAlphaDecision, type ClosedAlphaEntry } from '@/lib/alpha/gate';
import record from '../../../../deployments/aztec-mainnet.json';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const w = (await getVerifiedCaller(req))?.toLowerCase() ?? null;
  if (!w || !/^0x[0-9a-f]{40}$/.test(w)) return NextResponse.json({ ok: false, reasons: ['Sign in with your Ethereum wallet.'] }, { status: 401, headers: NO_STORE });
  const classId = (req.nextUrl.searchParams.get('classId') || '').toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(classId)) return NextResponse.json({ ok: false, reasons: ['Invalid class id.'] }, { status: 400, headers: NO_STORE });
  const rec = record as { closedAlpha?: ClosedAlphaEntry; contracts?: { classId?: string; tracksCurrentArtifact?: boolean; status?: string }[] };
  const deployedClasses = (rec.contracts ?? []).filter((c) => c.tracksCurrentArtifact && c.status !== 'do-not-use' && c.classId).map((c) => String(c.classId));
  const m = await prisma.alphaMember.findUnique({ where: { walletAddress: w } }).catch(() => undefined);
  if (m === undefined) return NextResponse.json({ ok: false, reasons: ['The closed alpha state could not be read. Nothing was sent.'] }, { status: 503, headers: NO_STORE });
  const decision = closedAlphaDecision({
    entry: rec.closedAlpha ?? null,
    now: new Date(),
    classId,
    deployedClasses,
    member: m ? { active: !m.revokedAt, riskAcknowledged: !!m.riskAckAt } : null,
  });
  return NextResponse.json(decision.ok ? { ok: true, reasons: [] } : decision, { headers: NO_STORE });
}
