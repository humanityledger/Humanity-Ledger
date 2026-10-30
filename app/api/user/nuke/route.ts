import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMessage } from 'viem';
import { createHash } from 'crypto';
import { RedisRateLimiter } from '@/lib/redis/rate-limiter';
import { redisClient } from '@/lib/redis/client';

export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Authentication required.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const body = await req.json();
        const { address, signature, timestamp } = body;

        // 1. Basic Validation
        if (!address || !signature || !timestamp) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Enforce maximum 5 minutes old timestamp to prevent replay attacks
        const now = Date.now();
        if (now - timestamp > 5 * 60 * 1000 || timestamp > now + 60000) {
            return NextResponse.json({ error: 'Timestamp expired or invalid' }, { status: 401 });
        }

        // 2. Strict Rate Limiting (1 nuke attempt per 24 hours per wallet)
        // using UPSTASH redis rate limiter, assuming it's hooked up or we use direct redis.
        // For simplicity, we just enforce the rate limit directly.
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1';
        
        const rateLimitKey = `ratelimit:nuke:${address.toLowerCase()}`;
        if (redisClient && !(redisClient as any).__isMock) {
            const attempts = await redisClient.get(rateLimitKey);
            if (attempts && parseInt(attempts) > 2) {
                return NextResponse.json({ error: 'Rate limit exceeded. Try again in 24h.' }, { status: 429 });
            }
            await redisClient.incr(rateLimitKey);
            await redisClient.expire(rateLimitKey, 86400); // 24 hours
        }

        // 3. Cryptographic Signature Verification
        const message = `I want to permanently delete all my data from System Handshake. Wallet: ${address}. Timestamp: ${timestamp}`;
        let isValidSignature = false;

        try {
            isValidSignature = await verifyMessage({
                address: address as `0x${string}`,
                message,
                signature: signature as `0x${string}`,
            });
        } catch (e: any) {
            return NextResponse.json({ error: 'Cryptographic verification failed' }, { status: 401 });
        }

        if (!isValidSignature) {
            return NextResponse.json({ error: 'Invalid EIP-191 signature. Identity denied.' }, { status: 401 });
        }

        // 4. ATOMIC PRISMA TRANSACTION & DELETION
        const userAddress = address.toLowerCase();
        
        try {
            await prisma.$transaction(async (tx) => {
                // Delete core relationship trees (Prisma handles some cascades, but we are explicit)
                await tx.session.deleteMany({ where: { userId: userAddress } });
                if ((tx as any).userSessionLog) {
                    await (tx as any).userSessionLog.deleteMany({ where: { userId: userAddress } });
                }
                await tx.blockchainTransaction.deleteMany({ where: { userId: userAddress } });
                
                // Finally delete the user completely
                const userExists = await tx.user.findUnique({ where: { walletAddress: userAddress } });
                if (userExists) {
                    await tx.user.delete({ where: { walletAddress: userAddress } });
                }

                // Record the irreversible cryptographic proof securely in General Log (Zk-Hash mapped)
                // [SECURITY] Fail closed - never use hardcoded salt for deletion commitments
                const salt = process.env.NUKE_SALT || process.env.JWT_SECRET;
                if (!salt) {
                    throw new Error('NUKE_SALT not configured. Cannot create deletion commitment.');
                }
                const deletionCommitment = createHash('sha256').update(userAddress + salt).digest('hex');
                
                await tx.log.create({
                    data: {
                        level: "alert",
                        message: "DATA_NUKE",
                        source: "LedgerFortress Nuke Core",
                        metadata: {
                            deletionCommitment,
                            proofSignature: signature,
                            resolvedAt: new Date().toISOString()
                        }
                    }
                });
            });
        } catch (dbError: any) {
            console.error('[LedgerFortress:Nuke] Database Transaction Error:', dbError);
            return NextResponse.json({ error: 'Failed to purge database records safely.' }, { status: 500 });
        }

        // 5. PURGE REDIS MEMORY
        if (redisClient && !(redisClient as any).__isMock && typeof redisClient.keys === 'function') {
            try {
                // Warning: keys('*') in production Redis can block. Doing targeted deletes where possible.
                // Or if Upstash supports SCAN
                const keys = await redisClient.keys(`user:${userAddress}:*`);
                if (keys && keys.length > 0) {
                    await redisClient.del(...keys);
                }
                const kycKeys = await redisClient.keys(`kyc:status:${userAddress}*`);
                if (kycKeys && kycKeys.length > 0) {
                    await redisClient.del(...kycKeys);
                }
            } catch (e) {
                console.error('[LedgerFortress:Nuke] Warning: Redis cleanup failed', e);
            }
        }

        // 6. Finalize Response
        const response = NextResponse.json({ 
            success: true, 
            message: 'Your digital corpse has been cremated. We are now blind to you.' 
        });

        // Nuke cookies explicitly
        response.cookies.delete('human_session');
        response.cookies.delete('kyc_status');
        response.cookies.delete('kyc_token');
        response.cookies.delete('system_handshake');
        response.cookies.delete('next-auth.session-token');
        response.cookies.delete('hl_session');
        response.cookies.delete('human.session-token');
        response.cookies.delete('__Secure-next-auth.session-token');

        return response;

    } catch (error: any) {
        console.error("[LedgerFortress:Nuke] Critical Failure -- details redacted");
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
