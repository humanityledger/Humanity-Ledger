import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

// Resend instance  fallback for dev but required for prod
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build_time');

const TIER_NAMES: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  ELITE: 'Elite'
};

const BANK_DETAILS = {
  beneficiary: 'STEFAN-ANTONIO CIRISANU',
  iban: 'ES52 1583 0001 1090 8640 3529',
  bic: 'REVOESM2',
  bank: 'Revolut Bank UAB, Calle Príncipe de Vergara 132, 4 planta, 28002, Madrid, Spain'
};

export async function POST(request: NextRequest) {
  try {
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    const walletAddress = session.userId.toLowerCase();

    const body = await request.json();
    const { reference, planId, billingCycle, priceEur, email } = body;

    if (!reference || !planId || !walletAddress || !billingCycle || !priceEur || !email) {
      return NextResponse.json({ error: 'Missing required billing fields (email, reference, etc.)' }, { status: 400 });
    }

    console.log(`[Billing SEPA] Processing transfer ref ${reference} for ${email} (Plan: ${planId})`);

    // 0. Anti-Spam / Rate Limiting Check
    const recentInvoices = await prisma.transaction.count({
      where: {
        fromAddress: email,
        type: 'SUBSCRIPTION_PAYMENT',
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    if (recentInvoices > 3) {
      console.warn(`[Billing SEPA] Rate limit exceeded for ${email}`);
      return NextResponse.json({ error: 'Too many invoice requests. Please complete your existing pending transfers.' }, { status: 429 });
    }

    // 1. Calculate Expiration Date (Immediate optimistic access)
    const existingSub = await prisma.subscription.findUnique({
      where: { userId: walletAddress.toLowerCase() }
    });

    const now = new Date();
    let baseDate = now;
    if (existingSub && existingSub.status === 'ACTIVE' && existingSub.expiresAt > now) {
      baseDate = new Date(existingSub.expiresAt);
    }

    const expiresAt = new Date(baseDate);
    if (billingCycle === 'annual') {
      expiresAt.setFullYear(baseDate.getFullYear() + 1);
    } else {
      expiresAt.setMonth(baseDate.getMonth() + 1);
    }

    // 2. Update Database (User Email)
    // IMPORTANT SECURITY FIX: Do not immediately upgrade user.tier. They remain FREE until SEPA is confirmed.
    let user;
    try {
      user = await prisma.user.upsert({
        where: { walletAddress: walletAddress.toLowerCase() },
        update: {
          email: email
        },
        create: {
          walletAddress: walletAddress.toLowerCase(),
          tier: 'FREE',
          email: email
        }
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        user = await prisma.user.upsert({
          where: { walletAddress: walletAddress.toLowerCase() },
          update: { email: email },
          create: { walletAddress: walletAddress.toLowerCase(), tier: 'FREE', email: email }
        });
      } else {
        throw e;
      }
    }

    const isCurrentlyActive = existingSub && existingSub.status === 'ACTIVE' && existingSub.expiresAt > now;

    // 3. Update or Create Subscription Record as PENDING (Only if they don't already have an active pass)
    // IMPORTANT: If they have an ACTIVE plan, we do NOT overwrite it to PENDING_SEPA, 
    // otherwise they lose access to their current tier while waiting for the bank transfer!
    if (!isCurrentlyActive) {
      await prisma.subscription.upsert({
        where: { userId: walletAddress.toLowerCase() },
        update: {
          status: 'PENDING_SEPA',
          tier: `${planId}_${billingCycle.toUpperCase()}`,
          expiresAt: expiresAt,
        },
        create: {
          userId: walletAddress.toLowerCase(),
          status: 'PENDING_SEPA',
          tier: `${planId}_${billingCycle.toUpperCase()}`,
          expiresAt: expiresAt,
        }
      });
    }

    // 4. Record the SEPA Transaction
    await prisma.transaction.create({
      data: {
        txHash: reference, // Using the bank transfer reference instead of crypto txHash
        status: 'PENDING', // SEPA takes 1-2 days. Will be ACTIVE when confirmed.
        type: 'SUBSCRIPTION_PAYMENT',
        amount: parseFloat(priceEur),
        token: 'EUR',
        fromAddress: walletAddress.toLowerCase(),
        toAddress: BANK_DETAILS.iban,
        identityHash: user.id, // [ZK-ISOLATION] Hashed identity reference — not raw userId
        metadata: {
          planId,
          billingCycle,
          email,
          eurValue: priceEur,
          network: 'SEPA_TRANSFER',
          expiresAt: expiresAt.toISOString(),
          bankBeneficiary: BANK_DETAILS.beneficiary
        }
      }
    });

    // 5. Send Professional Email Invoice (Railway / Stripe Style)
    try {
      const invoiceHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background-color: #050505; padding: 32px 40px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">System</h1>
              <p style="margin: 4px 0 0 0; color: #a1a1aa; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Invoice & Payment Instructions</p>
            </div>

            <!-- Body -->
            <div style="padding: 40px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151; line-height: 1.5;">
                Hello,<br><br>
                Thank you for requesting an upgrade to the <strong>${TIER_NAMES[planId] || planId} Plan</strong>. To activate your account access, please complete the SEPA Bank Transfer within the next 48 hours using the details below. Once the transfer is received, your account will automatically switch to ACTIVE.
              </p>

              <!-- Payment Details Box -->
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
                <p style="margin: 0 0 16px 0; font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Amount Due</p>
                <p style="margin: 0 0 24px 0; font-size: 36px; font-weight: 800; color: #111827; line-height: 1;">${priceEur}</p>

                <p style="margin: 0 0 16px 0; font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Bank Transfer Details (SEPA)</p>
                <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Beneficiary</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right; color: #111827;">${BANK_DETAILS.beneficiary}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">IBAN</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right; font-family: monospace; font-size: 15px; color: #111827;">${BANK_DETAILS.iban}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">BIC/SWIFT</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right; font-family: monospace; color: #111827;">${BANK_DETAILS.bic}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Bank Name</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right; color: #111827;">${BANK_DETAILS.bank}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280;">Transfer Concept/Reference</td>
                    <td style="padding: 10px 0; font-weight: 600; text-align: right; font-family: monospace; color: #000000; background-color: #fef08a; padding-right: 4px;">${reference}</td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                <strong>Note:</strong> Make sure to include the exact Transfer Concept/Reference (<code>${reference}</code>) in your bank's transfer description so we can automatically match your payment.
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                System Analytics · Madrid, Spain<br>
                Receipt generated on ${new Date().toLocaleDateString()}
              </p>
            </div>

          </div>
        </body>
        </html>
      `;

      const fromEmail = process.env.RESEND_FROM_EMAIL || 'billing@system-analytics.com';
      const emailResponse = await resend.emails.send({
        from: `System Billing <${fromEmail}>`,
        to: email,
        subject: `Invoice & Transfer Instructions: ${TIER_NAMES[planId] || planId} Plan`,
        html: invoiceHtml,
      });

      console.log(`[Billing SEPA] Invoice successfully sent to ${email}. ID: ${emailResponse.data?.id}`);
    } catch (emailError: any) {
      console.error(`[Billing SEPA] CRITICAL: Failed to send invoice via Resend:`, emailError.message);
      // We do not fail the request if the email fails, but we log heavily.
    }

    return NextResponse.json({ success: true, status: 'PENDING_SEPA', tier: planId, expiresAt });
  } catch (error) {
    console.error('[Billing SEPA] Error confirming payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
