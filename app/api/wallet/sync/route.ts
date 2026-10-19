import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cashier } from '@/lib/wallet/deposit-watcher';
import { verifyMessage } from 'viem';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json().catch(() => ({}));
    const { walletAddress, signature, message } = body;

    //  SOVEREIGN AUTHENTICATION RESOLUTION 
    let userId: string | undefined = undefined;

    if (signature && message && walletAddress) {
      try {
            const isValid = await verifyMessage({
                address: walletAddress as `0x${string}`,
                message: message,
                signature: signature as `0x${string}`
            });

            if (!isValid) {
                console.error(`[Security:Sync] Verification FAILED for ${walletAddress}`);
                return NextResponse.json({ error: 'Identity verification failed: Signature mismatch.' }, { status: 401 });
            }
            
            userId = walletAddress.toLowerCase();
            console.log(`[Security:Sync] Identity verified via ECDSA for ${walletAddress}`);
          } catch (e: any) {
            console.error(`[Security:Sync:Error]`, e.message);
            return NextResponse.json({ error: 'Identity verification error: Invalid payload.' }, { status: 400 });
          }
    } else if ((session as any)?.user?.email) {
      userId = (session as any).user.email.toLowerCase();
    } else {
      return NextResponse.json({ error: 'Unauthorized: Cryptographic Handshake required.' }, { status: 401 });
    }

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized: No identity resolved.' }, { status: 401 });
    }

    // Ensure User exists in DB for foreign key constraints
    const existingUser = await prisma.user.findUnique({ where: { walletAddress: userId } });
    if (!existingUser) {
        await prisma.user.create({
            data: {
                walletAddress: userId,
                tier: 'INITIATE',
                lastActive: new Date()
            }
        });
    } else {
        await prisma.user.update({
            where: { walletAddress: userId },
            data: { lastActive: new Date() }
        });
    }

    // Trigger Sync (Only if it's a valid address)
    let result = null;
    if (userId.startsWith('0x')) {
        result = await cashier.syncUserBalance(userId, userId);
    }

    const response = NextResponse.json({
        success: true,
        ...(result || {})
    });

    const kycStatus = 'UNVERIFIED';

    //  Mint System JWT (human_session) 
    try {
        const { mintJWT } = await import('@/lib/jwt');
        const sessionToken = await mintJWT({
            sub: userId,
            address: userId,
            clearance: 'Private',
            tier: existingUser?.tier || 'FREE',
            kycStatus: kycStatus,
            humanityScore: existingUser?.humanityScore || 0,
            issuedAt: new Date().toISOString()
        });

        response.cookies.set('human_session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 604800, // 7 days
        });

        // Cache tier in Redis for 10 min (Edge Middleware Rate Limiting)
        const { safeRedisSet } = await import('@/lib/redis/client');
        await safeRedisSet(`tier:${userId}`, JSON.stringify({
            tier: existingUser?.tier || 'FREE',
            kycStatus: kycStatus,
            humanityScore: existingUser?.humanityScore || 0
        }), 'EX', 600);

    } catch (jwtErr) {
        console.error('[WalletSync] Failed to mint human_session:', jwtErr);
    }

    // Clean backend architecture: issue the identity cookie directly from the server
    // after cryptographic verification, reducing client-side trust.
    response.cookies.set('system_handshake', userId, {
        path: '/',
        maxAge: 604800, // 7 days
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false // false so the frontend can read it if needed, but issued by backend
    });

    // --- REAL-TIME CLOUDFLARE GEOLOCATION & ANALYTICS ---
    try {
        const country = req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country') || 'UNKNOWN';
        if (country !== 'UNKNOWN') {
            const { redisClient } = await import('@/lib/redis/client');
            // Track unique wallets per country
            const isNew = await (redisClient as any).sadd(`wc:unique_country_wallets:${country}`, userId).catch(() => 0);
            if (isNew) {
                // Keep the old fast hincrby for the global map
                await (redisClient as any).hincrby('wc:country', country, 1).catch(() => {});
            }
        }
    } catch (e) {
        console.error('[WalletSync] Failed to update telemetry:', e);
    }

    return response;

  } catch (error: any) {
    console.error('Wallet Sync Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

