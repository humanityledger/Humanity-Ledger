import { NextResponse } from 'next/server';
import { redisClient as redis } from '@/lib/redis/client';
import { OmnichannelAlertEvent } from '@/lib/types/alerts';
import crypto, { createHash, timingSafeEqual } from 'crypto';

const STREAM_KEY = 'global_crypto_alerts';
const MIN_KEY_LENGTH = 16;

function digest(s: string): Buffer {
    return createHash('sha256').update(s).digest();
}

// THE INGESTION ENGINE (Producer)
// Microservices and chain-listeners POST to this endpoint.
// We inject directly into Redis Streams.
export async function POST(request: Request) {
    try {
        // [SOVEREIGN HARDENING]: Authentication mandatory for ingestion
        // A-028: Fail closed if INTERNAL_INGEST_KEY is unset or too short.
        // Previously fell back to crypto.randomBytes(32) on every cold start.
        const internalKey = process.env.INTERNAL_INGEST_KEY;
        if (!internalKey || internalKey.length < MIN_KEY_LENGTH) {
            console.error('[INGEST:FATAL] INTERNAL_INGEST_KEY is not configured or too short.');
            return NextResponse.json({ error: 'Ingest service not configured' }, { status: 503 });
        }

        const authKey = request.headers.get('X-Ingest-Key') || '';
        if (!authKey || !timingSafeEqual(digest(authKey), digest(internalKey))) {
            console.warn(`[INGEST:Unauthorized] Access denied from IP: ${request.headers.get('x-forwarded-for')}`);
            return NextResponse.json({ error: 'Omega Clearance Level Required' }, { status: 401 });
        }

        const body = await request.json();
        const { type, chain, severity, payload, targetAudience, userIds, channels } = body;

        // Basic validation
        if (!type || !chain || !severity || !payload || !channels) {
            return NextResponse.json({ error: 'Missing core event fields: type, chain, severity, payload, or channels' }, { status: 400 });
        }

        // Construct the Omnichannel Event
        const event: OmnichannelAlertEvent = {
            eventId: crypto.randomUUID(),
            timestamp: Date.now(),
            type,
            chain,
            severity,
            payload,
            targetAudience: targetAudience || 'GLOBAL',
            userIds: userIds || [],
            channels: channels || ['UI_INAPP']
        };

        // Fire-and-Forget into Redis Stream (O(1) latency)
        // Format: XADD STREAM_KEY MAXLEN ~ 100000 * data JSON_String
        await redis.xadd(STREAM_KEY, 'MAXLEN', '~', 100000, '*', 'data', JSON.stringify(event));

        return NextResponse.json({ 
            success: true, 
            message: 'Event injected into Megalodon Stream successfully', 
            eventId: event.eventId 
        });

    } catch (error) {
        console.error('Ingestion Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
