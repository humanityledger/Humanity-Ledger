// Emergency unlock script - run with: node scripts/emergency-enclave-unlock.mjs
// This directly connects to the Railway PostgreSQL DB and:
// 1. Clears all PIN lockouts (enclaveOtpAttempts + enclaveOtpExpiresAt)
// 2. Clears all enclavePinHash (users will re-enroll with correct normalized hash)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:ulPcqhptKuQiFkxRQfcabCKdJwDRsOQm@nozomi.proxy.rlwy.net:38927/railway'
    }
  }
});

async function main() {
  console.log('=== EMERGENCY ENCLAVE UNLOCK ===');
  console.log('Connecting to Railway PostgreSQL...');

  // Step 1: Count currently locked users
  const lockedNow = await prisma.user.count({
    where: { enclaveOtpAttempts: { gt: 0 } }
  }).catch(() => 0);
  console.log(`Currently locked users: ${lockedNow}`);

  const withPin = await prisma.user.count({
    where: { enclavePinHash: { not: null } }
  }).catch(() => 0);
  console.log(`Users with PIN set: ${withPin}`);

  // Step 2: Clear ALL lockouts
  const unlocked = await prisma.user.updateMany({
    where: { enclaveOtpAttempts: { gt: 0 } },
    data: { enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null }
  }).catch(e => { console.error('User unlock error:', e.message); return { count: 0 }; });
  console.log(`✅ Unlocked ${unlocked.count} user records`);

  // Also clear authUser lockouts
  const unlockedAuth = await prisma.authUser.updateMany({
    where: { enclaveOtpAttempts: { gt: 0 } },
    data: { enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null }
  }).catch(e => { console.error('AuthUser unlock error:', e.message); return { count: 0 }; });
  console.log(`✅ Unlocked ${unlockedAuth.count} authUser records`);

  // Step 3: Clear ALL enclavePinHash (forces re-enrollment with correct lowercase userId hash)
  const cleared = await prisma.user.updateMany({
    where: { enclavePinHash: { not: null } },
    data: { enclavePinHash: null }
  }).catch(e => { console.error('PIN clear error:', e.message); return { count: 0 }; });
  console.log(`✅ Cleared ${cleared.count} PIN hashes (users will re-enroll)`);

  const clearedAuth = await prisma.authUser.updateMany({
    where: {},
    data: { enclavePinHash: null }
  }).catch(e => { console.error('AuthUser PIN clear error:', e.message); return { count: 0 }; });
  console.log(`✅ Cleared ${clearedAuth.count} authUser PIN hashes`);

  console.log('');
  console.log('=== DONE ===');
  console.log('All users are now UNLOCKED.');
  console.log('All PIN hashes cleared - users will see first-time setup on next Ledger Chat visit.');
  console.log('New PINs will be hashed with normalized lowercase userId - no more case mismatch lockouts.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
