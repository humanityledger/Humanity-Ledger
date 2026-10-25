import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    const { planName, priceStr } = await request.json();

    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Payment gateway unconfigured: STRIPE_SECRET_KEY is not defined.' }, { status: 503 });
    }

    const stripe = new Stripe(apiKey, {
      apiVersion: '2025-02-24.acacia',
    });

    const unitAmount = parseInt(priceStr.replace(/[^0-9]/g, '')) * 100;
    if (isNaN(unitAmount) || unitAmount <= 0) {
      return NextResponse.json({ error: 'Invalid price amount' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || 'https://humanityledger.com';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Studio Provenance - ${planName}`,
              description: 'Digital Product Passport Compliance Plan',
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
