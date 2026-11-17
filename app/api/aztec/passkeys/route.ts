/**
 * /api/aztec/passkeys — encrypted backup of the private wallet's passkey records.
 *
 * GET    ?network=testnet|mainnet   the signed-in wallet's records
 * PUT    { record }                 add or replace one record (its evm must be the caller)
 * DELETE ?credentialId=…            remove one of the caller's records
 *
 * A record is ciphertext of the account root under a key only the passkey's authenticator can
 * produce (PRF). The server checks shape, owner and count; it cannot read the root. Signed-in
 * Ethereum wallets only (getVerifiedCaller); an email identity has no private wallet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { rateLimit } from '@/lib/security/premium-security';
import { MAX_PASSKEYS, PasskeyRecordSchema } from '@/lib/aztec/wallet/passkey';

export const dynamic = 'force-dynamic';

const NETWORKS = new Set(['testnet', 'mainnet']);
const CREDENTIAL_ID = /^[A-Za-z0-9_-]{16,1400}$/;

async function caller(req: NextRequest): Promise<string | null> {
  const a = (await getVerifiedCaller(req))?.toLowerCase() ?? null;
  return a && /^0x[0-9a-f]{40}$/.test(a) ? a : null;
}

function limited(who: string) {
  return !rateLimit(`aztec-passkeys:${who}`).allowed;
}

export async function GET(req: NextRequest) {
  const who = await caller(req);
  if (!who) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401 });
  if (limited(who)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  const network = req.nextUrl.searchParams.get('network') ?? '';
  if (!NETWORKS.has(network)) return NextResponse.json({ error: 'Unknown network.' }, { status: 400 });
  const rows = await prisma.aztecPasskeyRecord.findMany({
    where: { walletAddress: who, network },
    orderBy: { createdAt: 'asc' },
    take: MAX_PASSKEYS,
  });
  const records = rows.flatMap((r) => {
    try {
      const p = PasskeyRecordSchema.safeParse(JSON.parse(r.record));
      return p.success && p.data.evm === who ? [p.data] : [];
    } catch {
      return [];
    }
  });
  return NextResponse.json({ records }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest) {
  const who = await caller(req);
  if (!who) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401 });
  if (limited(who)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const p = PasskeyRecordSchema.safeParse((body as any)?.record);
  if (!p.success) return NextResponse.json({ error: 'Invalid passkey record.' }, { status: 400 });
  const r = p.data;
  if (r.evm !== who) return NextResponse.json({ error: 'This record belongs to another account.' }, { status: 403 });

  const existing = await prisma.aztecPasskeyRecord.findUnique({ where: { credentialId: r.credentialId } });
  if (existing && existing.walletAddress !== who) {
    return NextResponse.json({ error: 'This passkey is enrolled for another account.' }, { status: 409 });
  }
  // A new credential, or one moved to another network, counts against that network's limit.
  if (!existing || existing.network !== r.network) {
    const count = await prisma.aztecPasskeyRecord.count({ where: { walletAddress: who, network: r.network } });
    if (count >= MAX_PASSKEYS) return NextResponse.json({ error: `At most ${MAX_PASSKEYS} passkeys per account.` }, { status: 409 });
  }
  await prisma.aztecPasskeyRecord.upsert({
    where: { credentialId: r.credentialId },
    create: { walletAddress: who, network: r.network, credentialId: r.credentialId, record: JSON.stringify(r) },
    update: { network: r.network, record: JSON.stringify(r) },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const who = await caller(req);
  if (!who) return NextResponse.json({ error: 'Sign in with your Ethereum wallet.' }, { status: 401 });
  if (limited(who)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  const id = req.nextUrl.searchParams.get('credentialId') ?? '';
  if (!CREDENTIAL_ID.test(id)) return NextResponse.json({ error: 'Invalid credential id.' }, { status: 400 });
  const { count } = await prisma.aztecPasskeyRecord.deleteMany({ where: { credentialId: id, walletAddress: who } });
  return NextResponse.json({ ok: true, removed: count });
}
