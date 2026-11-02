import { Queue, Worker, QueueEvents } from 'bullmq';
import { redisClient } from '../redis/client';
import { prisma } from '../prisma';

const isMockRedis = (redisClient as any)?.__isMock || (redisClient as any)?.__isBuildMock;

export const stripeQueue = isMockRedis ? ({} as Queue) : new Queue('stripe-webhook', {
  connection: redisClient as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false, // Send to Dead Letter Queue (failed jobs stay in queue)
  },
});

export const stripeQueueEvents = isMockRedis ? ({} as QueueEvents) : new QueueEvents('stripe-webhook', {
  connection: redisClient as any,
});

// Ends paid access everywhere it is recorded. The cancellation path used to
// reset User.tier only: the Subscription row stayed ACTIVE with no expiry, and
// lib/security/premium-security.ts grants access from that row, so a
// cancelled subscriber kept the paid features.
async function endSubscription(dbUser: { id: string; walletAddress: string }) {
  await prisma.user.update({
    where: { id: dbUser.id },
    data: { tier: 'FREE', stripeSubscriptionId: null } as any,
  });
  await (prisma as any).subscription.updateMany({
    where: { userId: dbUser.walletAddress },
    data: { status: 'CANCELED', expiresAt: new Date() },
  }).catch((e: unknown) => console.error('[WAC] Could not close the subscription row:', e));
  await redisClient.setex(`tier:${dbUser.walletAddress}`, 600, 'FREE');
  await redisClient.del(`human_session:${dbUser.walletAddress}`);
  await redisClient.publish('system_mesh_auth_bus', JSON.stringify({
    event: 'LICENSE_REVOKED',
    wallet: dbUser.walletAddress,
    tier: 'FREE',
  }));
}

// Note: In Next.js, workers should ideally be run in a separate process.
// For the scope of this implementation, we initialize the worker here.
const stripeWorker = isMockRedis ? null : new Worker('stripe-webhook', async (job) => {
  const event = job.data;
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // 100000% Payment Verification Rule: must be paid or subscription (trial starts as unpaid)
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      console.warn(`[WAC] Webhook checkout complete but payment_status is ${session.payment_status}. Skipping upgrade.`);
      return { processed: true, status: session.payment_status };
    }

    // Check if it's a subscription mode checkout
    if (session.mode === 'subscription') {
      const walletAddress = (
        session.metadata?.userId ||
        session.metadata?.system_user_id ||
        (session.subscription_data as any)?.metadata?.system_user_id
      ) as string | undefined;
      const planId = (session.metadata?.tier || session.metadata?.plan_id) as string | undefined;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!walletAddress || !planId) {
        throw new Error(`Missing system metadata in checkout session. Got: walletAddress=${walletAddress}, tier=${planId}`);
      }

      const normalizedWallet = walletAddress.toLowerCase();
      const tierUpper = planId.toUpperCase();

      // 1. Upsert user tier & stripe IDs
      await prisma.user.upsert({
        where: { walletAddress: normalizedWallet },
        update: {
          tier: tierUpper,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        } as any,
        create: {
          walletAddress: normalizedWallet,
          tier: tierUpper,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        } as any,
      });

      // 2. Upsert Subscription record
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await (prisma as any).subscription.upsert({
        where: { userId: normalizedWallet },
        update: {
          tier: tierUpper,
          status: 'ACTIVE',
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          expiresAt: null, // active subscription, expires when cancelled
        },
        create: {
          userId: normalizedWallet,
          tier: tierUpper,
          status: 'ACTIVE',
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          expiresAt: null,
        },
      }).catch(() => {
        // Subscription table may not have stripeCustomerId field — fallback
        return (prisma as any).subscription.upsert({
          where: { userId: normalizedWallet },
          update: { tier: tierUpper, status: 'ACTIVE' },
          create: { userId: normalizedWallet, tier: tierUpper, status: 'ACTIVE', expiresAt: null },
        });
      });

      // 3. Update Redis cache & emit mesh bus event
      await redisClient.setex(`tier:${normalizedWallet}`, 600, tierUpper);
      await redisClient.publish('system_mesh_auth_bus', JSON.stringify({
        event: 'LICENSE_UPGRADED',
        wallet: normalizedWallet,
        tier: tierUpper
      }));

      // 4. Send Push Notification to User
      try {
        const dbUser = await (prisma as any).user.findUnique({ where: { walletAddress: normalizedWallet } });
        if (dbUser) {
          await (prisma as any).notification.create({
            data: {
              userId: dbUser.id,
              title: "Upgrade Successful!",
              message: `Your account has been upgraded to ${tierUpper} via Stripe. Welcome to the elite!`,
              type: "system",
              actionUrl: "/studio/provenance"
            }
          });
        }
      } catch (e) {
        console.warn(`[WAC] Failed to send push notification to ${normalizedWallet}:`, e);
      }

      // Invalidate human_session in Redis so middleware forces re-hydration
      await redisClient.del(`human_session:${normalizedWallet}`);
      
      console.log(`[WAC] ✅ Successfully upgraded wallet ${normalizedWallet} to tier ${tierUpper} (subscription: ${subscriptionId})`);
    }
  } else if (event.type === 'customer.subscription.updated') {
    // Handles subscription renewals and plan changes
    const subscription = event.data.object;
    const customerId = subscription.customer as string;
    const status = subscription.status; // 'active', 'trialing', 'past_due', etc.
    const tier = (subscription.metadata as any)?.tier as string | undefined;
    
    const dbUser = await (prisma as any).user.findFirst({ where: { stripeCustomerId: customerId } });
    if (dbUser && tier && (status === 'active' || status === 'trialing')) {
      await (prisma as any).subscription.upsert({
        where: { userId: dbUser.walletAddress },
        update: { tier: tier.toUpperCase(), status: 'ACTIVE' },
        create: { userId: dbUser.walletAddress, tier: tier.toUpperCase(), status: 'ACTIVE', expiresAt: null },
      }).catch(() => {/* ignore if subscription table schema differs */});
      await redisClient.setex(`tier:${dbUser.walletAddress}`, 600, tier.toUpperCase());
      console.log(`[WAC] Subscription updated for ${dbUser.walletAddress}: ${tier} / ${status}`);
    } else if (dbUser && (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired')) {
      // A subscription that stopped being paid used to keep its ACTIVE row,
      // so access continued. End it the same way as a deletion.
      await endSubscription(dbUser);
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer as string;
    
    // Find user by customerId
    const dbUser = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId }
    });

    if (dbUser) {
      await endSubscription(dbUser);
      console.log(`[WAC] Successfully downgraded customer ${customerId} to FREE`);
    }
  }
  
  // Return early if event is handled or not relevant
  return { processed: true, type: event.type };
}, { connection: redisClient as any });

stripeWorker?.on('failed', (job, err) => {
  console.error(`[BullMQ] Stripe Webhook Job ${job?.id} failed with error: ${err.message}`);
});
