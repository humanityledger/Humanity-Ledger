/**
 * lib/communities/identity.ts
 *
 * Which members of a community carry Ledger Chat's verified flag (User.isZkVerified, set only by
 * the server's own verification routes). Read-only: nothing here sets the flag, and no badge is
 * shown for anything else. External credentials (ZKPassport and similar) are described in
 * lib/aztec/zkpassport.ts and are not wired to this flag.
 */

import { prisma } from '@/lib/prisma';

const ADDRESS = /^0x[0-9a-f]{40}$/;

/** Lower-case wallets among `addresses` whose account is verified. Never throws: an empty set is a valid answer. */
export async function zkVerifiedWallets(addresses: ReadonlyArray<string | null | undefined>): Promise<Set<string>> {
  const wanted = Array.from(new Set(addresses.map((a) => String(a ?? '').toLowerCase()).filter((a) => ADDRESS.test(a)))).slice(0, 2000);
  const out = new Set<string>();
  if (!wanted.length) return out;
  try {
    const rows: Array<{ walletAddress: string }> = await (prisma as any).user.findMany({
      where: { walletAddress: { in: wanted }, isZkVerified: true },
      select: { walletAddress: true },
    });
    for (const r of rows) out.add(String(r.walletAddress).toLowerCase());
  } catch {
    /* no badge is better than a wrong one */
  }
  return out;
}
