/**
 * The Prisma implementation of BetaStore (lib/beta/cusdc-beta-store.ts). Server only.
 * Tables: CusdcBetaInvite and CusdcBetaMember (prisma/migrations/20261122150000_cusdc_beta).
 */
import { prisma } from '@/lib/prisma';
import type { BetaMemberRow, BetaStore } from './cusdc-beta-store';

/** pg_advisory_xact_lock key for redemptions: one at a time, so two cannot pass the member limit. */
const REDEEM_LOCK = 72707371;

// The generated client gains these delegates with the migration; typed loosely until then.
type Db = {
  cusdcBetaMember: {
    findUnique(a: unknown): Promise<BetaMemberRow | null>;
    count(): Promise<number>;
    create(a: unknown): Promise<BetaMemberRow>;
    update(a: unknown): Promise<BetaMemberRow>;
  };
  cusdcBetaInvite: {
    updateMany(a: unknown): Promise<{ count: number }>;
    findUnique(a: unknown): Promise<{ id: string } | null>;
  };
  $executeRaw(q: TemplateStringsArray, ...v: unknown[]): Promise<unknown>;
  $transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
};

const db = prisma as unknown as Db;

export const prismaBetaStore: BetaStore = {
  findMember: (wallet) => db.cusdcBetaMember.findUnique({ where: { walletAddress: wallet } }),

  redeem: ({ wallet, codeHash, capacity, noticeVersion, at }) =>
    db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REDEEM_LOCK})`;
      if ((await tx.cusdcBetaMember.count()) >= capacity) return 'full' as const;
      const claimed = await tx.cusdcBetaInvite.updateMany({
        where: { codeHash, redeemedBy: null, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: at } }] },
        data: { redeemedBy: wallet, redeemedAt: at },
      });
      if (claimed.count !== 1) return 'bad' as const;
      const invite = await tx.cusdcBetaInvite.findUnique({ where: { codeHash } });
      return tx.cusdcBetaMember.create({
        data: { walletAddress: wallet, inviteId: invite!.id, noticeVersion, noticeAckAt: at },
      });
    }),

  confirmNotice: (wallet, noticeVersion, at) =>
    db.cusdcBetaMember.update({ where: { walletAddress: wallet }, data: { noticeVersion, noticeAckAt: at } }),
};
