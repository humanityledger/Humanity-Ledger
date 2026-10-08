// @ts-nocheck
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { username } = body;

        // Configuration
        const rpName = 'Humanity Ledger';
        const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost'; 

        // 1. Generate unique user identifier
        const userID = new Uint8Array(crypto.randomBytes(32));

        // 2. Generate registration options
        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID,
            userName: username || `user_${crypto.randomBytes(4).toString('hex')}`,
            authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'preferred',
            },
            supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
        });

        // 3. Store the challenge temporarily (Upstash Redis)
        let sessionId = crypto.randomBytes(16).toString('hex');
        try {
            const redis = Redis.fromEnv();
            await redis.set(`passkey_challenge:${sessionId}`, options.challenge, { ex: 300 }); // 5 min expiry
        } catch (e) {
            console.warn('[WebAuthn] Redis not configured, falling back to stateless challenge (Dev Only)');
            // For local testing if Redis isn't up
        }

        return NextResponse.json({ options, sessionId });
    } catch (error: any) {
        console.error('[WebAuthn] Generate Options Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}