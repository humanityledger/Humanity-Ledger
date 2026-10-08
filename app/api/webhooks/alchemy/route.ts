import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * [Elite] Alchemy Webhook Handler
 * Synchronizes DB with Blockchain reality (Source of Truth).
 */
export async function POST(req: Request) {
    try {
        const rawBody = await req.text();
        
        // [SECURITY HARDENING] Mandatory cryptographic validation
        const secret = process.env.ALCHEMY_WEBHOOK_SECRET;
        if (!secret) {
            console.error('[ALCHEMY WEBHOOK] CRITICAL: Webhook secret not configured.');
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
        }

        const signature = req.headers.get('x-alchemy-signature');
        if (!signature) {
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
        }

        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(rawBody);
        const digest = hmac.digest('hex');

        if (signature.length !== digest.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
            console.error('[ALCHEMY WEBHOOK] Signature mismatch. Spoofing attempt blocked.');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const body = JSON.parse(rawBody);
        const { event } = body;
        if (!event || !event.activity) {
            return NextResponse.json({ status: 'ignored' });
        }

        for (const activity of event.activity) {
            const hash = activity.hash;
            
            // We only care about transactions we have registered as PENDING
            const tx = await (prisma as any).blockchainTransaction.findUnique({
                where: { hash }
            });

            if (tx) {
                // Update final status
                await (prisma as any).blockchainTransaction.update({
                    where: { hash },
                    data: {
                        status: activity.category === 'external' ? 'CONFIRMED' : 'CONFIRMED',
                        updatedAt: new Date(),
                        // @ts-ignore - blockNumber exists in schema, Prisma types may lag
                        blockNumber: BigInt(activity.blockNum || 0),
                    } as any
                });
                console.log(`[ORCHESTRATOR] Transaction ${hash} CONFIRMED via Webhook`);
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error: any) {
        console.error('[WEBHOOK] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

