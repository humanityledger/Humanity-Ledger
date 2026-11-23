/**
 * The Prisma implementation of RequestStore (lib/beta/cusdc-beta-request.ts), and the lookup of an
 * invitation reserved for a wallet. Server only. Tables: CusdcBetaRequest, CusdcBetaInvite.reservedFor
 * (prisma/migrations/20261123160000_cusdc_beta_requests).
 */
import { prisma } from '@/lib/prisma';
import type { RequestRow, RequestStore } from './cusdc-beta-request';

// The generated client gains these with the migration; typed loosely until then.
type Db = {
  cusdcBetaRequest: {
    findUnique(a: unknown): Promise<RequestRow | null>;
    upsert(a: unknown): Promise<RequestRow>;
  };
  cusdcBetaInvite: { count(a: unknown): Promise<number> };
};
const db = prisma as unknown as Db;

export const prismaRequestStore: RequestStore = {
  find: (wallet) => db.cusdcBetaRequest.findUnique({ where: { walletAddress: wallet } }),
  create: (wallet, at) =>
    db.cusdcBetaRequest.upsert({ where: { walletAddress: wallet }, create: { walletAddress: wallet, requestedAt: at }, update: {} }),
};

/** True when an unused, unrevoked, unexpired invitation is reserved for this wallet. */
export async function hasReservedInvite(wallet: string, now: Date): Promise<boolean> {
  const n = await db.cusdcBetaInvite.count({
    where: { reservedFor: wallet, redeemedBy: null, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  });
  return n > 0;
}
