import { NextResponse } from 'next/server';
import { safeRedisGet, safeRedisSet, redisClient } from '@/lib/redis/client';
import { verifyMessage } from 'viem';
import { getClientForChain } from '@/lib/blockchain/rpc-engine';
import { mainnetClient } from '@/lib/blockchain/rpc-engine';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { token, address, signature, chainId } = body;
        
        if (!token || !address || !signature) {
            return NextResponse.json({ error: 'Missing sync data' }, { status: 400 });
        }

        const status = await safeRedisGet(`qr:${token}`);
        if (!status) {
            return new NextResponse('Sync session expired or invalid.', { status: 404 });
        }

        if (status !== 'PENDING') {
            return new NextResponse('Session already consumed or processed', { status: 400 });
        }

        let isValid = false;
        try {
            const message = `RE-CONNECT-LEDGER-SESSION-${token}`;
            
            isValid = await verifyMessage({
                address: address as `0x${string}`,
                message,
                signature: signature as `0x${string}`
            });

            if (!isValid && chainId) {
                const client = getClientForChain(chainId);
                if (client) {
                    isValid = await client.verifyMessage({
                        address: address as `0x${string}`,
                        message,
                        signature: signature as `0x${string}`
                    });
                }
            }
        } catch (e: any) {
            console.error('[QR-Sync] Signature verification error:', e);
            return NextResponse.json({ error: 'Verification failed' }, { status: 401 });
        }

        if (!isValid) {
            console.warn(`[Handshake:Reject] Invalid signature for ${address}. Token: ${token.slice(0, 8)}...`);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const normalizedAddress = address.toLowerCase();

        if (redisClient && typeof redisClient.publish === 'function') {
            await redisClient.publish('system_mesh_auth_bus', JSON.stringify({
                socketId: token,
                address: normalizedAddress,
                timestamp: Date.now()
            })).catch((err: any) => console.error('[MESH:PUBLISH_ERROR]', err));
        }

        await safeRedisSet(`qr:${token}`, JSON.stringify({ 
            address: normalizedAddress, 
            signature, 
            syncedAt: Date.now(),
        }), 'EX', 60);
        
        const { mintJWT } = await import('@/lib/jwt');
        const { prisma } = await import('@/lib/prisma');
        
        const user = await prisma.user.upsert({
            where: { walletAddress: normalizedAddress },
            update: { lastActive: new Date() },
            create: {
                walletAddress: normalizedAddress,
                tier: 'INITIATE',
                lastActive: new Date()
            }
        });

        const jwt = await mintJWT({
            sub: normalizedAddress,
            address: normalizedAddress,
            clearance: 'Private',
            tier: user.tier || 'FREE',
            kycStatus: 'UNVERIFIED',
            humanityScore: user.humanityScore || 0,
            iss: 'humanity-ledger',
            source: 'qr-sync-handshake',
            issuedAt: new Date().toISOString()
        });

        const host = req.headers.get("host") || "";
        const cookieDomain = (process.env.NODE_ENV === 'production' && host.includes("humanidfi.com")) ? 'humanidfi.com' : undefined;
        const response = NextResponse.json({ status: 'queued' });
        
        response.cookies.set('human_session', jwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 604800,
            path: '/',
            domain: cookieDomain,
        });

        return response;
    } catch (e: any) {
        console.error('[QR_SYNC_FATAL]', e);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
