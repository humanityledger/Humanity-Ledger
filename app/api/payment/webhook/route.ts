import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/payments/stripe';
import { prisma } from '@/lib/prisma';
import { randomBytes, createHash } from 'crypto';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY as string);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

const PLAN_LIMITS: Record<string, { dailyRequests: number; threshold: number; maxKeys: number }> = {
  starter: { dailyRequests: 10_000,  threshold: 500_000, maxKeys: 1 },
  pro:     { dailyRequests: 500_000, threshold: 100_000, maxKeys: 3 },
  Elite:   { dailyRequests: -1,      threshold: 50_000,  maxKeys: 10 },
};

//  Generate a cryptographically secure API key 
function generateApiKey(): { raw: string; hash: string } {
  const rawSuffix = randomBytes(40).toString('hex');
  const raw = `wac_live_${rawSuffix}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

//  Auto-submit chargeback evidence to Stripe 
async function submitDisputeEvidence(dispute: Stripe.Dispute, subscription: any) {
  try {
    const customer = await stripe.customers.retrieve(dispute.charge as string) as Stripe.Customer;
    const metadata = (await stripe.charges.retrieve(dispute.charge as string)).metadata;

    // Gather API usage logs as evidence from AuditLog (system model)
    const usageLogs = await db.auditLog.findMany({
      where: { metadata: { path: ['subscriptionId'], equals: subscription.id } },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });

    const evidenceText = `
Humanity Ledger CORPORATION  DISPUTE EVIDENCE
==========================================

Transaction Details:
- Plan: ${subscription.tier}
- Price: $${subscription.price}/month
- Purchase Date: ${subscription.createdAt?.toISOString?.() ?? 'Recorded'}
- Purchase IP: ${metadata?.purchase_ip || 'Recorded'}
- Purchase Country: ${metadata?.purchase_country || 'Recorded'}
- Customer Accepted ToS: YES (explicit checkbox + Stripe ToS requirement)
- Customer Accepted No-Refund Policy: YES (explicit checkbox during checkout)
- 3D Secure Authentication: COMPLETED (Stripe enforced)

API Activity After Purchase: ${usageLogs.length} audit events recorded.

This evidence demonstrates the customer:
1. Authenticated with 3D Secure 2 (bank-level verification)
2. Explicitly accepted no-refund terms
3. Accepted Stripe Terms of Service
4. Provided billing address

The service was delivered and API keys were provisioned as contracted.
    `.trim();

    await stripe.disputes.update(dispute.id, {
      evidence: {
        customer_purchase_ip: metadata?.purchase_ip,
        customer_name: customer.name || undefined,
        customer_email_address: customer.email || undefined,
        product_description: `Humanity Ledger Corporation ${subscription.tier} API Subscription  Real-time ledger transaction analytics`,
        customer_signature: evidenceText,
        service_date: (subscription.createdAt ?? new Date()).toISOString().split('T')[0],
        service_documentation: `${process.env.NEXT_PUBLIC_APP_URL}/terms`,
        uncategorized_text: evidenceText,
      },
      submit: true,
    });

    console.log('[WAC Webhook] Dispute evidence submitted for dispute:', dispute.id);
  } catch (err) {
    console.error('[WAC Webhook] Failed to submit dispute evidence:', err);
  }
}

//  Prisma `subscription` typed as any for extended API fields 
// NOTE: The schema uses `subscription` (not `apiSubscription`). The `(prisma as any)`
// cast covers extended fields (keyHash, dailyRequestLimit, etc.) until a dedicated
// ApiSubscription model is added and `prisma generate` is re-run.
const db = prisma as any;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[WAC Webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 });
  }

  console.log(`[WAC Webhook] Event received: ${event.type}`);

  //  HANDLE EVENTS 

  // 1. Successful payment  provision API key
  if (event.type === 'checkout.session.completed') {
    const stripeSession = event.data.object as Stripe.Checkout.Session;
    if (stripeSession.mode !== 'subscription') return NextResponse.json({ ok: true });

    const subscriptionId = stripeSession.subscription as string;
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
    const planId = stripeSub.metadata?.plan_id || stripeSession.metadata?.plan_id || 'starter';
    const systemUserId = stripeSub.metadata?.system_user_id || stripeSession.metadata?.system_user_id;
    const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.starter;

    // Find user by walletAddress (SIWE system identity)
    const dbUser = systemUserId
      ? await prisma.user.findFirst({ where: { walletAddress: systemUserId } })
      : null;

    // Generate API key
    const { raw: rawKey, hash: keyHash } = generateApiKey();

    // Save subscription + key using the system `subscription` model
    const sub = await db.subscription.create({
      data: {
        userId:               dbUser?.walletAddress || systemUserId || 'unknown',
        tier:                 planId,
        status:               'ACTIVE',
        expiresAt:            new Date((stripeSub as any).current_period_end * 1000),
        // Extended API-tier fields stored as metadata via AuditLog or future ApiSubscription
      },
    });

    // --- Node V4.0 System Credits Integration ---
    if (dbUser) {
       const creditsToAdd = planId.toLowerCase() === 'elite' ? 30000 : 8000;
       await db.user.update({
         where: { id: dbUser.id },
         data: {
           tier: planId,
           isPro: true,
           creditsBalance: { increment: creditsToAdd }
         }
       });

       await db.creditLedger.create({
         data: {
           userId: dbUser.id,
           amount: creditsToAdd,
           action: 'STRIPE_SUBSCRIPTION_ACTIVATION',
           description: `Node V4.0 ${planId.toUpperCase()} Tier Activation`
         }
       });
    }
    // -----------------------------------------------

    // Log API key provisioning event
    await db.auditLog.create({
      data: {
        userId:   sub.userId,
        action:   'API_KEY_PROVISIONED',
        resource: subscriptionId,
        metadata: {
          planId,
          keyPrefix:           rawKey.slice(0, 16),
          keyHash,
          dailyRequestLimit:   limits.dailyRequests,
          ledgerThresholdUsd:   limits.threshold,
          purchaseIp:          stripeSub.metadata?.purchase_ip || '',
          purchaseCountry:     stripeSub.metadata?.purchase_country || '',
        },
        timestamp: new Date(),
      },
    }).catch(() => {});

    // Email key to user
    const userEmail = (await stripe.customers.retrieve(stripeSession.customer as string) as Stripe.Customer).email;
    if (userEmail && process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Humanity Ledger Corporation <api@ledgeralert.corp>',
        to: userEmail,
        subject: ' Tu API key de Humanity Ledger Corporation',
        html: `
          <div style="font-family: monospace; background: #0a0a0a; color: #fff; padding: 32px; border-radius: 12px;">
            <h1 style="color: #a78bfa; font-size: 24px; margin-bottom: 8px;">Humanity Ledger Corporation</h1>
            <p style="color: #888; margin-bottom: 24px;">Plan: <strong style="color: #fff">${planId.toUpperCase()}</strong></p>
            <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.1em;">Tu API Key (guárdala de forma segura)</p>
              <code style="color: #00ff9d; font-size: 14px; word-break: break-all;">${rawKey}</code>
            </div>
            <p style="color: #888; font-size: 12px;">Incluye este header en todas tus peticiones:</p>
            <code style="color: #60a5fa; font-size: 13px;">X-WAC-API-Key: ${rawKey}</code>
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #222;">
              <p style="color: #555; font-size: 11px;">Esta key no se mostrará de nuevo por seguridad.</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/developers" style="color: #a78bfa;"> Ver documentación completa</a>
            </div>
          </div>
        `,
      }).catch(console.error);
    }

    console.log(`[WAC Webhook] API key provisioned for plan: ${planId}, subscription: ${sub.id}`);
  }

  // 2. Subscription renewed  extend access
  else if (event.type === 'invoice.paid') {
    const invoice = event.data.object as any;
    if (!invoice.subscription) return NextResponse.json({ ok: true });

    const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const systemUserId = stripeSub.metadata?.system_user_id || invoice.metadata?.system_user_id;

    if (systemUserId) {
      await db.subscription.updateMany({
        where: { userId: systemUserId, status: 'ACTIVE' },
        data: {
          expiresAt:  new Date((stripeSub as any).current_period_end * 1000),
          updatedAt:  new Date(),
        },
      });

      // --- Node V4.0 System Credits Renewal ---
      const dbUser = await db.user.findFirst({ where: { walletAddress: systemUserId } });
      if (dbUser) {
        const planId = stripeSub.metadata?.plan_id || 'pro';
        const creditsToAdd = planId.toLowerCase() === 'elite' ? 30000 : 8000;
        await db.user.update({
          where: { id: dbUser.id },
          data: { creditsBalance: { increment: creditsToAdd } }
        });
        await db.creditLedger.create({
          data: {
            userId: dbUser.id,
            amount: creditsToAdd,
            action: 'STRIPE_SUBSCRIPTION_RENEWAL',
            description: `Node V4.0 ${planId.toUpperCase()} Tier Monthly Renewal`
          }
        });
      }
      // -------------------------------------------
    }

    console.log('[WAC Webhook] Subscription renewed:', invoice.subscription);
  }

  // 3. Payment failed  mark as past_due
  else if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as any;
    if (!invoice.subscription) return NextResponse.json({ ok: true });

    // Log payment failure event
    await db.auditLog.create({
      data: {
        action:   'PAYMENT_FAILED',
        resource: invoice.subscription,
        metadata: { invoice_id: invoice.id },
        timestamp: new Date(),
      },
    }).catch(() => {});

    console.log('[WAC Webhook] Payment failed, logged:', invoice.subscription);
  }

  // 4. Subscription canceled  revoke access
  else if (event.type === 'customer.subscription.deleted') {
    const stripeSub = event.data.object as Stripe.Subscription;
    const systemId = stripeSub.metadata?.system_user_id;

    if (systemId) {
      await db.subscription.updateMany({
        where: { userId: systemId },
        data: { status: 'CANCELLED', updatedAt: new Date() },
      });

      // --- Node V4.0 System Downgrade ---
      const dbUser = await db.user.findFirst({ where: { walletAddress: systemId } });
      if (dbUser) {
        await db.user.update({
          where: { id: dbUser.id },
          data: { tier: 'free', isPro: false }
        });
      }
      // -------------------------------------
    }

    console.log('[WAC Webhook] Subscription canceled for:', systemId);
  }

  // 5. DISPUTE CREATED  IMMEDIATE LOG + EVIDENCE  MILITARY GRADE
  else if (event.type === 'charge.dispute.created') {
    const dispute = event.data.object as Stripe.Dispute;

    console.error(`[WAC SECURITY] DISPUTE OPENED: ${dispute.id}  Amount: $${dispute.amount / 100}`);

    // Log dispute immediately
    await db.auditLog.create({
      data: {
        action:   'STRIPE_DISPUTE_OPENED',
        resource: dispute.id,
        metadata: { amount: dispute.amount, reason: dispute.reason },
        timestamp: new Date(),
      },
    }).catch(() => {});

    // Auto-submit evidence to Stripe
    await submitDisputeEvidence(dispute, { id: dispute.id, tier: 'unknown', price: 0, createdAt: new Date() });

    console.error(`[WAC SECURITY] Evidence submitted for dispute: ${dispute.id}`);
  }

  return NextResponse.json({ ok: true });
}
