/**
 * /api/alpha/status — the signed-in wallet's closed alpha state.
 *   GET            { member, active, riskAcknowledged }
 *   POST { ack: true }  records that the tester acknowledged the risks (consent screen)
 * Signed session only. Stores the time of the acknowledgement and nothing else.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

async function who(req: NextRequest) {
  const a = (await getVerifiedCaller(req))?.toLowerCase() ?? null;
  return a && /^0x[0-9a-f]{40}$/.test(a) ? a : null;
}

export async function GET(req: NextRequest) {
  const w = await who(req);
  if (!w) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401, headers: NO_STORE });
  const m = await prisma.alphaMember.findUnique({ where: { walletAddress: w } });
  return NextResponse.json({ member: !!m, active: !!m && !m.revokedAt, riskAcknowledged: !!m?.riskAckAt }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const w = await who(req);
  if (!w) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401, headers: NO_STORE });
  const body = await req.json().catch(() => ({}));
  if (body?.ack !== true) return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: NO_STORE });
  const m = await prisma.alphaMember.findUnique({ where: { walletAddress: w } });
  if (!m || m.revokedAt) return NextResponse.json({ error: 'This account has no closed alpha invitation.' }, { status: 403, headers: NO_STORE });
  await prisma.alphaMember.update({ where: { walletAddress: w }, data: { riskAckAt: m.riskAckAt ?? new Date() } });
  return NextResponse.json({ member: true, active: true, riskAcknowledged: true }, { headers: NO_STORE });
}
