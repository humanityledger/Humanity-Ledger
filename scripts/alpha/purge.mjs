#!/usr/bin/env node
/**
 * Deletes the personal fields of the closed alpha admission once their retention ends (package 4):
 * 6 months after the end of the alpha (retainUntil). Run by the operator with DATABASE_URL set,
 * or by a scheduled job. Idempotent; prints how many rows it cleared.
 *
 *   node scripts/alpha/purge.mjs            (clears rows whose retainUntil has passed)
 *   node scripts/alpha/purge.mjs --dry-run  (counts only)
 */
import { PrismaClient } from '@prisma/client';

const dry = process.argv.includes('--dry-run');
const prisma = new PrismaClient();
const now = new Date();
try {
  const due = { retainUntil: { lte: now } };
  if (dry) {
    const [i, m] = await Promise.all([prisma.alphaInvite.count({ where: due }), prisma.alphaMember.count({ where: due })]);
    console.error(`Due: ${i} invitation(s), ${m} tester(s). Nothing changed (dry run).`);
  } else {
    const i = await prisma.alphaInvite.updateMany({
      where: due,
      data: { sanctionsCheckedAt: null, sanctionsListDate: null, sanctionsResult: null, adultCheckedAt: null, retainUntil: null },
    });
    const m = await prisma.alphaMember.updateMany({
      where: due,
      data: { termsAcceptedAt: null, termsSha256: null, risksAcceptedAt: null, risksSha256: null, eligibilityAcceptedAt: null, eligibilitySha256: null, retainUntil: null },
    });
    console.error(`Cleared ${i.count} invitation(s) and ${m.count} tester(s).`);
  }
} finally {
  await prisma.$disconnect();
}
