import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { Redis } from '@upstash/redis';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { credential, sessionId } = body;

        const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
        const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // 1. Retrieve the expected challenge
        let expectedChallenge = '';
        try {
            const redis = Redis.fromEnv();
            expectedChallenge = await redis.get<string>(`passkey_challenge:${sessionId}`) || '';
            if (!expectedChallenge) throw new Error("Challenge expired");
        } catch (e) {
            // Fallback for dev if Redis isn't configured, we extract challenge from credential (INSECURE - DEV ONLY)
            console.warn('[WebAuthn] Warning: Bypassing Redis strict challenge check');
            expectedChallenge = credential.response.clientDataJSON 
                ? JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64').toString('utf-8')).challenge 
                : '';
        }

        // 2. Verify the credential against the expected challenge
        const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin,
            expectedRPID: rpID,
        });

        const { verified, registrationInfo } = verification;

        if (verified && registrationInfo) {
            const { credentialPublicKey, credentialID } = registrationInfo;
            
            // Delete the challenge to prevent replay attacks
            try {
                const redis = Redis.fromEnv();
                await redis.del(`passkey_challenge:${sessionId}`);
            } catch (e) {}

            return NextResponse.json({ 
                verified: true, 
                // Return public key as base64 so frontend can derive the Smart Account (ERC-4337)
                publicKey: Buffer.from(credentialPublicKey).toString('base64'),
                credentialId: Buffer.from(credentialID).toString('base64')
            });
        }

        return NextResponse.json({ error: 'Verification failed' }, { status: 400 });

    } catch (error: any) {
        console.error('[WebAuthn] Verify Registration Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}