import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICE_IDS } from '@/lib/payments/stripe';
import { prisma } from '@/lib/prisma';
import { validateSecureRequest } from '@/lib/security/premium-security';
import { NODE_TIERS, PlanTier } from '@/lib/node_infrastructure/tiers';

/**
 * Elite Checkout Tunnel
 * Generates a secure Stripe Checkout Session with tier metadata.
 * SIWE-native: userId is always a wallet address (no Clerk dependency).
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const tier = (body.tier as string)?.toUpperCase() as PlanTier;
        const isAnnual = body.isAnnual === true;
        const billingCycle = isAnnual ? 'ANNUAL' : 'MONTHLY';
        // Goes into the Stripe return URLs: a plain tab name only.
        const returnTab = typeof body.returnTab === 'string' && /^[a-z0-9_-]{1,32}$/i.test(body.returnTab) ? body.returnTab : 'dashboard';

        // ── Auth: a signed-in session only ──
        // [SECURITY 2026-10-28] An address in the request body used to be
        // accepted when there was no session. Anyone could then open a Stripe
        // checkout tied to another person's Stripe customer (which shows that
        // customer's email and saved details), create account rows for any
        // address, and start the 30-day trial for it. The address now always
        // comes from the session; one sent in the body must match it.
        const validation = await validateSecureRequest(req);
        const userId = validation.valid ? validation.userId : undefined;

        if (!userId) {
            return NextResponse.json({ error: 'Sign in with your wallet to buy a plan.' }, { status: 401 });
        }
        const bodyAddress = body.userId || body.walletAddress;
        if (typeof bodyAddress === 'string' && bodyAddress && bodyAddress.toLowerCase() !== userId.toLowerCase()) {
            return NextResponse.json({ error: 'The connected wallet does not match your session. Sign in again.' }, { status: 403 });
        }

        if (!tier) {
            return NextResponse.json({ error: 'Invalid plan tier' }, { status: 400 });
        }
        if (!PRICE_IDS[billingCycle]?.[tier]) {
            return NextResponse.json({ error: 'Stripe price not configured for this plan. Contact support.' }, { status: 503 });
        }

        const planConfig = NODE_TIERS[tier];
        if (!planConfig) {
            return NextResponse.json({ error: 'Plan configuration not found' }, { status: 400 });
        }

        const normalizedUserId = userId.toLowerCase();

        // [VIP BYPASS] Special Owner Exception — permanent, unlimited access.
        // Reached only with the owner's own signed-in session (see above).
        const ownerWallet = (process.env.OWNER_WALLET || process.env.ADMIN_WALLET_ADDRESS || '').toLowerCase();
        if (ownerWallet && normalizedUserId === ownerWallet) {
            const PERMANENT_DATE = new Date('2099-12-31T23:59:59Z');
            await prisma.user.upsert({
                where: { walletAddress: normalizedUserId },
                update: { tier: 'ARCHIVE_PROVER' },
                create: { walletAddress: normalizedUserId, tier: 'ARCHIVE_PROVER' }
            });
            await prisma.subscription.upsert({
                where: { userId: normalizedUserId },
                update: { tier: 'ARCHIVE_PROVER', status: 'ACTIVE', expiresAt: PERMANENT_DATE },
                create: { userId: normalizedUserId, tier: 'ARCHIVE_PROVER', status: 'ACTIVE', expiresAt: PERMANENT_DATE }
            });
            return NextResponse.json({ url: `/terminal?tab=${returnTab}&upgrade=success` });
        }

        // SIWE-native: userId is always a walletAddress
        const user = await prisma.user.upsert({
            where: { walletAddress: normalizedUserId },
            update: {},
            create: { walletAddress: normalizedUserId, tier: 'FREE' }
        });

        if (!user) {
            return NextResponse.json({ error: 'Failed to resolve user' }, { status: 404 });
        }

        let priceId = PRICE_IDS[billingCycle][tier];
        if (!priceId) {
            // Stripe price not configured for this tier/cycle combination.
            return NextResponse.json({ error: 'Stripe price ID not configured for this plan. Please contact support.' }, { status: 503 });
        }

        // Auto-resolve prod_ IDs to their default price_ IDs (Intelligent Routing)
        if (priceId.startsWith('prod_') || priceId.startsWith('price_')) {
            try {
                if (priceId.startsWith('prod_')) {
                    const product = await stripe.products.retrieve(priceId);
                    if (!product.default_price) throw new Error('Product has no default price');
                    priceId = typeof product.default_price === 'string' ? product.default_price : product.default_price.id;
                } else {
                    await stripe.prices.retrieve(priceId);
                }
            } catch (err) {
                console.warn('[STRIPE_PRODUCT_RESOLVER] Product/Price missing. Initiating Auto-Bootstrap...', priceId);
                try {
                    const priceAmount = billingCycle === 'ANNUAL' ? planConfig.priceMetrics.annual : planConfig.priceMetrics.monthly;
                    const newProduct = await stripe.products.create({
                        name: `Humanity Ledger - ${planConfig.name}`,
                        description: `Cryptographic Node Infrastructure - ${tier} Tier`,
                        metadata: { tier: tier }
                    });
                    const newPrice = await stripe.prices.create({
                        product: newProduct.id,
                        unit_amount: priceAmount,
                        currency: 'usd',
                        recurring: { interval: billingCycle === 'ANNUAL' ? 'year' : 'month' },
                    });
                    await stripe.products.update(newProduct.id, { default_price: newPrice.id });
                    priceId = newPrice.id;
                    console.log(`[STRIPE_AUTO_BOOTSTRAP] Successfully created Price ID: ${priceId}`);
                } catch (bootstrapErr: any) {
                    console.error('[STRIPE_BOOTSTRAP_ERROR]', bootstrapErr);
                    // Stripe's message stays in the server log: it can name keys and account details.
                    return NextResponse.json({ error: 'Payments are not available right now. Please try again later.' }, { status: 503 });
                }
            }
        }

        // Build correct return URLs based on context
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://humanidfi.com';
        const successPath = returnTab === 'studio' ? '/studio/provenance' : `/terminal?tab=${returnTab}`;
        const cancelPath  = returnTab === 'studio' ? '/studio/provenance' : `/terminal?tab=${returnTab}`;

        // Create Stripe Checkout Session payload
        const sessionPayload: any = {
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${appUrl}${successPath}?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${appUrl}${cancelPath}?upgrade=canceled`,
            metadata: {
                userId: normalizedUserId,
                tier: tier,
                env: process.env.NODE_ENV ?? 'production',
                billingCycle: billingCycle,
                // Trillion Parameters Articulation:
                requestsPerDay: planConfig.limits.requestsPerDay.toString(),
                maxApiKeys: planConfig.limits.maxApiKeys.toString(),
                maxTokens: planConfig.limits.maxTokens.toString(),
                dataWindowHours: planConfig.limits.dataWindowHours.toString(),
                ft_webSockets: planConfig.features.webSockets ? 'yes' : 'no',
                ft_fixProtocol: planConfig.features.fixProtocol ? 'yes' : 'no',
                ft_hmacRequired: planConfig.features.hmacRequired ? 'yes' : 'no',
                ft_ipWhitelist: planConfig.features.ipWhitelist ? 'yes' : 'no',
                ft_darkPool: planConfig.features.darkPoolDetection ? 'yes' : 'no',
                ft_csvExport: planConfig.features.csvExport ? 'yes' : 'no'
            },
            subscription_data: {
                trial_period_days: 30,
                metadata: {
                    system_user_id: normalizedUserId,
                    tier: tier,
                    billingCycle: billingCycle,
                    maxTokens: planConfig.limits.maxTokens.toString(),
                    requestsPerDay: planConfig.limits.requestsPerDay.toString(),
                    ft_darkPool: planConfig.features.darkPoolDetection ? 'yes' : 'no'
                }
            }
        };

        if (user.stripeCustomerId) {
            sessionPayload.customer = user.stripeCustomerId;
        } else {
            sessionPayload.customer_email = user.email || undefined;
        }

        const session = await stripe.checkout.sessions.create(sessionPayload);

        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error('[STRIPE_CHECKOUT_ERROR]', error);
        return NextResponse.json({ error: 'Failed to initialize payment tunnel' }, { status: 500 });
    }
}
