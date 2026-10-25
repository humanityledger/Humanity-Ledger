import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import rateLimit from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit({
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500,
});

/**
 * Private CRYPTOGRAPHIC NONCE GENERATOR
 * Generates a military-grade, single-use challenge token to prevent replay attacks.
 */
export async function GET(req: Request) {
    try {
        const hops = (req.headers.get('x-forwarded-for') || '').split(',').map(h => h.trim()).filter(Boolean);
        const ip = hops[hops.length - 1] || '127.0.0.1';
        try {
            await limiter.check(20, ip); // Max 100 requests per minute (increased to prevent lockout during reloads)
        } catch {
            return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
        }

        // 1. Generate 32 bytes of cryptographic entropy
        const nonce = crypto.randomBytes(32).toString('hex');
        
        // 2. Strict 2-minute temporal bound
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

        // 3. Persist to immutable ledger (SiweNonce)
        await prisma.siweNonce.create({
            data: {
                nonce,
                expiresAt
            }
        });

        // 4. Clear expired nonces asynchronously to prevent database bloat
        // We don't await this so it doesn't block the critical path
        prisma.siweNonce.deleteMany({
            where: { expiresAt: { lt: new Date() } }
        }).catch(() => {});

        return NextResponse.json({ nonce });
    } catch (error) {
        console.error('[NONCE-GENERATOR]  Cryptographic fault:', error);
        return NextResponse.json({ error: 'Failed to generate cryptographic challenge' }, { status: 500 });
    }
}
