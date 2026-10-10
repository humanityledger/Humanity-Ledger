import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build_time');

const getSender = (name: string) => {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  return `${name} <${fromEmail}>`;
};

// Supply Unlocks Data (Matching DilutionTracker)
const unlocks = [
    {
        tokenSymbol: 'AUTH',
        tokenName: 'Identity',
        unlockDate: new Date('2026-03-05T00:00:00Z'),
        amount: '6.62M',
        type: 'LINEAR',
        percentageOfSupply: 0.12
    },
    {
        tokenSymbol: 'ARB',
        tokenName: 'Arbitrum',
        unlockDate: new Date('2026-03-16T00:00:00Z'),
        amount: '92.65M',
        type: 'CLIFF',
        percentageOfSupply: 1.1
    },
    {
        tokenSymbol: 'OP',
        tokenName: 'Optimism',
        unlockDate: new Date('2026-03-31T00:00:00Z'),
        amount: '31.34M',
        type: 'CLIFF',
        percentageOfSupply: 0.56
    }
];

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized CRON execution' }, { status: 401 });
        }
        
        console.log("[CRON] Executing Hourly Supply Alerts...");
        
        // Find subscribers who want hourly supply dilution alerts
        const subscribers = await prisma.emailSubscriber.findMany({
            where: {
                subscribed: true,
                frequency: 'hourly'
            }
        });

        if (subscribers.length === 0) {
            console.log("[CRON] No active subscribers found for supply alerts.");
            return NextResponse.json({ success: true, message: "No subscribers to alert." });
        }

        // Calculate time left for each token
        let htmlRows = '';
        const now = new Date().getTime();

        unlocks.forEach(unlock => {
            const diff = unlock.unlockDate.getTime() - now;
            let timeString = "UNLOCKED";

            if (diff > 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                timeString = `${days}d ${hours}h ${minutes}m`;
            }

            htmlRows += `
                <div style="background-color: #f9f9f9; padding: 15px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid #333;">
                    <h3 style="margin: 0 0 10px; color: #111;">${unlock.tokenName} (${unlock.tokenSymbol})</h3>
                    <p style="margin: 0; font-size: 14px; color: #555;">
                        <strong>Amount:</strong> ${unlock.amount} <br/>
                        <strong>Impact:</strong> +${unlock.percentageOfSupply}% of supply <br/>
                        <strong>Time Left:</strong> <span style="color: ${diff > 0 ? '#d97706' : '#16a34a'}; font-weight: bold;">${timeString}</span>
                    </p>
                </div>
            `;
        });

        // The Email HTML structure
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: sans-serif; background-color: #f4f4f4; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2 style="color: #000; margin: 0;"> Hourly Supply Monitors</h2>
                  <p style="color: #666; margin-top: 5px;">Humanity Ledger Logic - Real-Time Tracking</p>
                </div>
                
                <p>Hello VIP,</p>
                <p>Here is your hourly real-time update on the upcoming capital dilution events across major protocols:</p>
                
                ${htmlRows}
                
                <p style="margin-top: 30px; font-size: 12px; color: #888; text-align: center;">
                  You requested hourly monitoring for Airdrop/Unlock dates. <br/>
                  <a href="#">Unsubscribe from these alerts</a>
                </p>
              </div>
            </body>
            </html>
        `;

        // Dispatch emails parallelly (batching recommended for big lists, but okay for MVP)
        const emailPromises = subscribers.map(sub => 
            resend.emails.send({
                from: getSender('Humanity Ledger Vault'),
                to: sub.email,
                subject: ' Real-Time Supply Unlock Alert (Hourly Update)',
                html: htmlContent
            }).catch(err => console.error(`[CRON] Failed to send email to ${sub.email}:`, err))
        );

        await Promise.all(emailPromises);

        console.log(`[CRON] Hourly Supply Alerts sent to ${subscribers.length} users successfully.`);
        return NextResponse.json({ success: true, sentCount: subscribers.length });

    } catch (error: any) {
        console.error("[CRON] Supply Alerts Error:", error);
        return NextResponse.json({ error: 'Failed to process supply alerts' }, { status: 500 });
    }
}


