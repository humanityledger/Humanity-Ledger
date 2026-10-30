import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRedisClient } from '@/lib/redis/client';
import { safeJsonParse } from '@/lib/utils/json';
import crypto from 'crypto';

const redis = createRedisClient({ name: 'Ledger-Webhook' });

// This endpoint receives HTTP POST requests from an on-chain indexing service like Alchemy Custom Webhooks or QuickNode Destinatioms.
export async function POST(req: Request) {
    try {
        const rawBody = await req.text();
        
        //  MANDATORY Cryptographic Signature Validation 
        // [SECURITY HARDENING] Previously used `if (secret && signature)` which made
        // authentication OPTIONAL. If ALCHEMY_WEBHOOK_SECRET was unset, ANY anonymous
        // actor could flood the system with fake ledger signals to manipulate attesting.
        const secret = process.env.ALCHEMY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
        if (!secret) {
            console.error('[WEBHOOK SECURITY] CRITICAL: No webhook secret configured. Rejecting all requests.');
            return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 503 });
        }

        const signature = req.headers.get('x-alchemy-signature') || req.headers.get('x-quicknode-signature');
        if (!signature) {
            return NextResponse.json({ success: false, error: 'Missing signature header' }, { status: 401 });
        }

        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(rawBody);
        const digest = hmac.digest('hex');
        
        // Prevent timing attacks with constant-time comparison
        const sigHash = crypto.createHash('sha256').update(signature).digest();
        const digestHash = crypto.createHash('sha256').update(digest).digest();
        if (!crypto.timingSafeEqual(sigHash, digestHash)) {
            console.error('[WEBHOOK ERROR] Cryptographic signature mismatch. Possible spoofing attack.');
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid Cryptographic Signature' }, { status: 401 });
        }

        const body = safeJsonParse(rawBody, null, 'LEDGER_WEBHOOK') as any;
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ success: false, error: 'Malformed or empty payload' }, { status: 400 });
        }

        // Parse Payload - Expecting an array of transfers.
        const activities = body.event?.activity || body.transfers || (Array.isArray(body) ? body : [body]);

        for (const activity of activities) {
            if (!activity) continue; // Skip null entries in corrupted arrays
            const { fromAddress, toAddress, value, asset, hash, category } = activity;
            const threshold = 500000; // $500k Ledger Threshold for notifications

            // Rough estimation if missing fiat value (assuming stablecoin or ETH payload mostly)
            const usdValue = (activity as any).usdValue || (asset === 'ETH' ? value * 3000 : value);

            if (usdValue >= threshold) {
                const txHash = hash || (activity as any).transactionHash || `0xWeb3Tx${Date.now()}`;
                const safeAsset = asset || 'UNKNOWN';

                // 1. Create a Persistent DB Notification (Global)
                await prisma.notification.create({
                    data: {
                        userId: null, // Global Notification
                        title: ` ${usdValue >= 1000000 ? 'MEGALODON' : 'LEDGER'} DETECTED`,
                        message: `${category || 'TRANSFER'}: ${parseFloat(value).toFixed(2)} ${safeAsset} ($${usdValue.toLocaleString()})`,
                        type: 'ledger',
                        isGlobal: true,
                        actionUrl: `https://etherscan.io/tx/${txHash}`
                    }
                });

                // 2. Push to Redis for immediate WebSocket Engine pickup
                const streamPayload = {
                    id: `ledger-${Date.now()}`,
                    type: 'LEDGER',
                    asset: safeAsset,
                    usdValue: usdValue,
                    from: fromAddress,
                    to: toAddress,
                    txHash: txHash,
                    timestamp: new Date().toISOString()
                };

                await redis.publish('ledger_alerts_stream', JSON.stringify(streamPayload));
                
                // Keep the last 100 cached for late-joiners
                const cacheKey = 'latest_ledger_alerts';
                const cachedRaw = await redis.get(cacheKey);
                let cachedAlerts = safeJsonParse(cachedRaw, [], 'LEDGER_WEBHOOK') as any[];
                cachedAlerts.unshift(streamPayload);
                if (cachedAlerts.length > 100) cachedAlerts = cachedAlerts.slice(0, 100);
                await redis.set(cacheKey, JSON.stringify(cachedAlerts), 'EX', 86400); // 24h
                
                console.log(`[LEDGER WEBHOOK] Processed TX: ${txHash} -> $${usdValue.toLocaleString()}`);
            }
        }

        return NextResponse.json({ success: true, processed: activities.length });
    } catch (error) {
        console.error('[LEDGER WEBHOOK ERROR]', error);
        return NextResponse.json({ success: false, error: 'Internal processing failure' }, { status: 500 });
    }
}
