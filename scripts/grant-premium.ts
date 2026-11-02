/**
 * [Private ADMIN SCRIPT] grant-premium.ts
 * 
 * Grants Private tier access to a user by wallet address.
 * Zero-Clerk: uses native Prisma DB lookups only.
 *
 * Usage:
 *   npx ts-node -e "require('./scripts/grant-premium')"
 *   OR set TARGET_WALLET env var and run directly.
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

//  CONFIG 
const TARGET_WALLET = (process.env.TARGET_WALLET || process.env.OWNER_WALLET)?.toLowerCase();
if (!TARGET_WALLET) {
  console.error('[ERROR] TARGET_WALLET or OWNER_WALLET environment variable must be specified.');
  process.exit(1);
}
const TARGET_TIER   = 'Private';
// 

async function grantPremium() {
  console.log(`\n Granting ${TARGET_TIER} Access`);
  console.log(`   Wallet: ${TARGET_WALLET}`);
  console.log('-------------------------------------------');

  try {
    // 1. Upsert User in DB with Private tier
    console.log(' Upserting User in database...');
    const user = await prisma.user.upsert({
      where: { walletAddress: TARGET_WALLET.toLowerCase() },
      update: {
        tier: TARGET_TIER,
        isPro: true,
      },
      create: {
        walletAddress: TARGET_WALLET.toLowerCase(),
        tier: TARGET_TIER,
        isPro: true,
      },
    });
    console.log(` User record saved: ${user.walletAddress}  tier: ${user.tier}`);

    // 2. Upsert Subscription as lifetime
    console.log(' Creating/Updating Subscription record...');
    const existing = await prisma.subscription.findFirst({
      where: { userId: user.walletAddress }
    });

    const subscription = await prisma.subscription.upsert({
      where: { id: existing?.id || 'no-match' },
      update: {
        status: 'ACTIVE',
        tier: 'Private',
        expiresAt: new Date('2099-12-31'),
      },
      create: {
        userId: user.walletAddress,
        status: 'ACTIVE',
        tier: 'Private',
        expiresAt: new Date('2099-12-31'),
      },
    });
    console.log(` Subscription: ${subscription.id}  status: ${subscription.status}`);

    console.log('\n MISSION ACCOMPLISHED: Full system access granted.');

  } catch (error) {
    console.error(' Error during grant process:', error);
  } finally {
    await prisma.$disconnect();
  }
}

grantPremium();
