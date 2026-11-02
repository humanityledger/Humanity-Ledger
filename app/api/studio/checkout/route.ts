import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { stripe } from '@/lib/payments/stripe';
import { prisma } from '@/lib/prisma';
import { resolvePlan } from '@/lib/studio/metering';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/studio/checkout — Stripe Checkout for Ledger Studio Pro.
 * The existing Stripe webhook (lib/queues/bullmq.ts) reads metadata.tier and
 * sets the user's tier to STUDIO_PRO when the payment completes.
 * POST with { action: "portal" } opens the billing portal instead.
 */
export async function POST(req: NextRequest) {
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const wallet = auth.walletAddress;

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'NOT_CONFIGURED', message: 'Payments are not configured on this server.' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  // Redirect URLs come from configuration, not from the request's Host header.
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'NOT_CONFIGURED', message: 'NEXT_PUBLIC_APP_URL is not set.' }, { status: 503 });
  }
  const origin = (configured || req.nextUrl.origin).replace(/\/+$/, '');

  try {
    const user = await prisma.user.upsert({
      where: { walletAddress: wallet },
      update: {},
      create: { walletAddress: wallet, tier: 'FREE' },
      select: { stripeCustomerId: true, stripeSubscriptionId: true, email: true, tier: true },
    });

    if (body?.action === 'portal') {
      if (!user.stripeCustomerId) return NextResponse.json({ error: 'NO_BILLING', message: 'No billing account yet.' }, { status: 404 });
      const portal = await stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${origin}/studio` });
      return NextResponse.json({ url: portal.url });
    }

    const plan = await resolvePlan(wallet);
    if (plan.id === 'pro') return NextResponse.json({ error: 'ALREADY_PRO', message: 'Studio Pro is already part of your plan.' }, { status: 409 });
    // The webhook writes one tier and one subscription id per user. Buying
    // Studio Pro on top of another active subscription would overwrite it.
    const tier = String(user.tier || 'FREE').toUpperCase();
    if (user.stripeSubscriptionId && tier !== 'FREE') {
      return NextResponse.json({ error: 'OTHER_SUBSCRIPTION', message: 'You already have an active Humanity Ledger subscription. Manage it from billing before adding Studio Pro.' }, { status: 409 });
    }

    const price = process.env.STRIPE_PRICE_STUDIO_PRO;
    if (!price) return NextResponse.json({ error: 'NOT_CONFIGURED', message: 'The Studio Pro price is not configured (STRIPE_PRICE_STUDIO_PRO).' }, { status: 503 });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : user.email ? { customer_email: user.email } : {}),
      client_reference_id: wallet,
      metadata: { userId: wallet, tier: 'STUDIO_PRO', product: 'ledger-studio' },
      subscription_data: { metadata: { system_user_id: wallet, tier: 'STUDIO_PRO', product: 'ledger-studio' } },
      allow_promotion_codes: true,
      success_url: `${origin}/studio?upgrade=success`,
      cancel_url: `${origin}/studio?upgrade=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error('[studio/checkout]', e?.message);
    return NextResponse.json({ error: 'STRIPE_ERROR', message: 'Could not open checkout. Try again later.' }, { status: 502 });
  }
}
