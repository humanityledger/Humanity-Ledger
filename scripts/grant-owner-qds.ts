// scripts/grant-owner-qds.ts
// One-shot script to credit 21,000,000 QDs to the owner's Sovereign Identity.
// Run with: npx tsx scripts/grant-owner-qds.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OWNER_ADDRESS = (process.env.OWNER_WALLET || process.env.OWNER_ADDRESS)?.toLowerCase();
if (!OWNER_ADDRESS) {
  console.error('[ERROR] OWNER_WALLET or OWNER_ADDRESS environment variable must be specified.');
  process.exit(1);
}
const AMOUNT = 21_000_000;

async function main() {
  console.log(`[Ledger Network] Crediting ${AMOUNT.toLocaleString()} QDs to ${OWNER_ADDRESS}...`);

  // Check current balance first
  const [earnedAgg, spentAgg, receivedAgg, sentAgg] = await Promise.all([
    prisma.qdTransaction.aggregate({
      where: { aztecAddress: OWNER_ADDRESS, type: 'EARN' },
      _sum: { amount: true },
    }),
    prisma.qdTransaction.aggregate({
      where: { aztecAddress: OWNER_ADDRESS, type: { in: ['SPEND', 'SLASH'] } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { toAddress: OWNER_ADDRESS, token: 'QDs', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { fromAddress: OWNER_ADDRESS, token: 'QDs', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  const currentBalance =
    Number(earnedAgg._sum.amount || 0) +
    Number(receivedAgg._sum.amount || 0) -
    Number(spentAgg._sum.amount || 0) -
    Number(sentAgg._sum.amount || 0);

  console.log(`  Current balance: ${currentBalance.toLocaleString()} QDs`);

  // Insert the EARN transaction
  const record = await prisma.qdTransaction.create({
    data: {
      aztecAddress: OWNER_ADDRESS,
      type: 'EARN',
      amount: AMOUNT,
      description: 'Owner genesis allocation — testing & operational reserve for Turing Shield demo (ICAIEPHE-2026)',
    },
  });

  const newBalance = currentBalance + AMOUNT;
  console.log(`  Record created: ${record.id}`);
  console.log(`  New balance:    ${newBalance.toLocaleString()} QDs`);
  console.log(`[OK] Done.`);
}

main()
  .catch((e) => {
    console.error('[ERROR]', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

