import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { prisma as systemPrisma } from '@/lib/prisma';
import { createPublicClient, http, verifyMessage, parseEther } from 'viem';
import { optimism } from 'viem/chains';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { getClientIP } from '@/lib/security/rateLimiter';

// Cast to base PrismaClient so TypeScript resolves goldenTicket + user models correctly.
// The SystemPrismaClient augmentation adds cosmicEntity but doesn't remove base models 
// TypeScript just can't see them through the 'unknown' cast in lib/prisma.ts.
const prisma = systemPrisma as unknown as PrismaClient;

// Treasury wallet that receives the mint fee on Optimism
const TREASURY_WALLET = '0x78831C25c86eA2a78A6127fC2Ccb95E612D87b4a' as const;
const MINT_FEE_WEI = parseEther('0.00111');

// Verifies an Optimism transaction actually paid the treasury.
// Returns { verified: true } if confirmed, { verified: false, reason } on failure.
// Non-fatal: if the RPC times out we still let the user through (graceMode).
async function verifyOnChainPayment(txHash: string, fromAddress: string): Promise<{ verified: boolean; graceMode?: boolean; reason?: string }> {
    if (!txHash || !txHash.startsWith('0x')) return { verified: false, reason: 'No txHash provided' };
    try {
        const client = createPublicClient({
            chain: optimism,
            transport: http('https://mainnet.optimism.io', { timeout: 15_000 }),
        });
        const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
        if (!receipt || receipt.status !== 'success') {
            return { verified: false, reason: 'Transaction failed or not found on Optimism' };
        }
        const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
        const toMatches = tx.to?.toLowerCase() === TREASURY_WALLET.toLowerCase();
        const fromMatches = tx.from?.toLowerCase() === fromAddress.toLowerCase();
        const valueSufficient = tx.value >= MINT_FEE_WEI;
        if (!toMatches || !fromMatches || !valueSufficient) {
            console.warn(JSON.stringify({
                level: 'SECURITY', event: 'PAYMENT_MISMATCH',
                txHash, fromAddress,
                to: tx.to, from: tx.from,
                value: tx.value?.toString(),
                toMatches, fromMatches, valueSufficient,
            }));
            return { verified: false, reason: `Payment mismatch: to=${toMatches}, from=${fromMatches}, value=${valueSufficient}` };
        }
        console.log(JSON.stringify({ level: 'INFO', event: 'PAYMENT_VERIFIED_ON_CHAIN', txHash, fromAddress, value: tx.value?.toString() }));
        return { verified: true };
    } catch (e: any) {
        // RPC timeout or network error: allow through with grace mode (don't punish the user)
        console.warn('[GoldenTicket] On-chain payment verification failed (grace mode):', e?.message);
        return { verified: false, graceMode: true, reason: e?.message };
    }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_SUPPLY       = 1000;
const CLAIM_RATE_LIMIT = 3;    // Max 3 claim attempts per IP per hour
const RATE_WINDOW_SEC  = 3600; // 1 hour TTL

// 
// Redis-backed Rate Limiter & Heuristic Anomaly Detection (Zero-Trust)
// Prevents brute-force and automated sybil minting attacks.
// 
async function checkClaimRateLimit(ip: string, walletAddress: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    try {
        const { redisClient } = await import('@/lib/redis/client');
        if (!redisClient || (redisClient as any).__isMock) {
            return { allowed: true, remaining: CLAIM_RATE_LIMIT, resetAt: 0 };
        }
        
        // 1. Standard IP-based Rate Limiter
        const ipKey   = `rl:claim:ip:${ip}`;
        const current = await redisClient.incr(ipKey);
        if (current === 1) await redisClient.expire(ipKey, RATE_WINDOW_SEC);
        
        // 2. Anomaly Detection (Subnet / Farm protection)
        // Detects if the same IP is trying to claim with multiple different wallets rapidly.
        const velocityKey = `rl:anomaly:velocity:${ip}`;
        await redisClient.sadd(velocityKey, walletAddress);
        await redisClient.expire(velocityKey, 3600); // Track unique wallets per IP per hour
        const uniqueWallets = await redisClient.scard(velocityKey);

        if (uniqueWallets > 2) {
             console.warn(`[Security] Sybil Farm detected from IP ${ip}. Attempted ${uniqueWallets} unique wallet claims.`);
             return { allowed: false, remaining: 0, resetAt: Date.now() + 3600000 };
        }

        const ttl = await redisClient.ttl(ipKey);
        return {
            allowed:   current <= CLAIM_RATE_LIMIT,
            remaining: Math.max(0, CLAIM_RATE_LIMIT - current),
            resetAt:   Date.now() + ttl * 1000,
        };
    } catch {
        console.warn('[GoldenTicket] Rate limit Redis check failed  allowing request');
        return { allowed: true, remaining: 1, resetAt: 0 };
    }
}

// 
// POST /api/golden-ticket/claim
// One ticket per wallet address, enforced at DB + logic level.
// Rate limited: 3 attempts per IP per hour (Redis-backed).
// 
export async function POST(req: NextRequest) {
    // The FIRST X-Forwarded-For hop is whatever the client sent, so limiting on
    // it let anyone reset the 3-per-hour limit with a new header. getClientIP
    // takes the hop our own proxy appended (same rule as middleware.ts).
    const ip = getClientIP(req);

    //  Parse body 
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Missing request body' }, { status: 400 });
    }

    const { walletAddress, twitterHandle, signatureData, cryptoSignature, txHash } = body;

    //  Field-level validation 
    if (!walletAddress || typeof walletAddress !== 'string') {
        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const address = walletAddress.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(address)) {
        return NextResponse.json({ error: 'Malformed wallet address  must be 40 hex chars with 0x prefix' }, { status: 400 });
    }



    //  Payload size guard (DoS protection) 
    // signatureData is a canvas image data URL (base64). Cap to 10KB max.
    // Client-side fix (Vector Array) ensures this never triggers, but we
    // truncate defensively here instead of hard-rejecting so no user is blocked.
    // Increased to 150,000 to safely accommodate large JSON vector payloads without breaking JSON structure.
    const safeSignatureData =
        signatureData && typeof signatureData === 'string'
            ? signatureData.slice(0, 150_000)
            : (signatureData ?? null);

    //  twitterHandle XSS sanitization 
    // Strip HTML tags, script injections, and any non-safe characters.
    // Twitter handles are alphanumeric + underscore, max 15 chars per Twitter spec.
    const rawHandle   = typeof twitterHandle === 'string' ? twitterHandle : '';
    const cleanHandle = rawHandle
        .replace(/^@/, '')           // strip leading @
        .replace(/[^a-zA-Z0-9_]/g, '') // only alphanum + underscore allowed
        .slice(0, 50);               // max 50 chars (Twitter max is 15, we're generous)
    const safeHandle = cleanHandle.length > 0 ? cleanHandle : null;

    //  Redis-backed rate limit & Anomaly Detection 
    try {
        const rateCheck = await checkClaimRateLimit(ip, address);
        if (!rateCheck.allowed) {
            console.warn(JSON.stringify({
                level: 'SECURITY', event: 'CLAIM_RATE_LIMIT_HIT',
                ip, address, resetAt: new Date(rateCheck.resetAt).toISOString(),
            }));
            const retryAfter = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
            return NextResponse.json(
                { error: 'Too many claim attempts. Max 3 per hour.', retryAfter },
                {
                    status: 429,
                    headers: {
                        'Retry-After':           String(retryAfter),
                        'X-RateLimit-Limit':     String(CLAIM_RATE_LIMIT),
                        'X-RateLimit-Remaining': '0',
                    },
                }
            );
        }
    } catch { /* Rate limit failure is non-fatal  allow request */ }

    try {
        //  Verify Session or ECDSA signature ownership 
        const { getSession } = await import('@/lib/session');
        const session = await getSession();
        
        // Strategy:
        //   1. If cryptoSignature is a real ECDSA hex sig → verify it (works on ALL platforms)
        //   2. If cryptoSignature === 'SESSION_AUTH' → user is a native/QR login, use session cookie
        //   3. No signature + no session → 401
        const isSessionAuthSentinel = cryptoSignature === 'SESSION_AUTH';

        if (cryptoSignature && typeof cryptoSignature === 'string' && !isSessionAuthSentinel) {
            // ── Path A: ECDSA cryptographic verification ──────────────────────────
            // Works on ALL platforms: mobile WalletConnect, desktop MetaMask, Coinbase, Rainbow.
            let isValidSig = false;
            // Try current message format first
            try {
                isValidSig = await verifyMessage({
                    address:   walletAddress as `0x${string}`,
                    message:   `Humanity Ledger NETWORK GOLD ACCESS VERIFICATION: ${walletAddress}`,
                    signature: cryptoSignature as `0x${string}`,
                });
            } catch {}
            // Fallback: try legacy message format (backwards compat for older clients)
            if (!isValidSig) {
                try {
                    isValidSig = await verifyMessage({
                        address:   walletAddress as `0x${string}`,
                        message:   `Humanity Ledger NETWORK GOLD ACCESS: ${walletAddress}`,
                        signature: cryptoSignature as `0x${string}`,
                    });
                } catch {}
            }
            if (!isValidSig) {
                console.warn(JSON.stringify({ level: 'SECURITY', event: 'INVALID_SIGNATURE', ip, address }));
                return NextResponse.json({ error: 'Cryptographic signature is invalid or forged' }, { status: 401 });
            }
            // ✅ Valid ECDSA signature — proceed to minting
        } else {
            // ── Path B: Session-only (native Humanity Ledger login / QR login) ────
            // These users don't have a Wagmi wallet, they authenticate via HTTP session cookie.
            const isSessionAuthenticated = session?.userId?.toLowerCase() === address;
            if (!isSessionAuthenticated) {
                return NextResponse.json({
                    error: 'Authentication required. Please sign with your wallet or reconnect via the app.',
                }, { status: 401 });
            }
            // ✅ Valid session — proceed to minting
        }

        //  Fast-path: check for existing claim 
        const existing = await (prisma as any).goldenTicket.findUnique({
            where:  { userAddress: address },
            select: {
                id: true, ticketNumber: true, serialCode: true, tier: true,
                badgeColor: true, networkLaunchEligible: true, twitterHandle: true,
                isActive: true, claimedAt: true,
            },
        });
        if (existing) {
            return NextResponse.json({
                success: false, alreadyClaimed: true,
                ticket:  existing, serial: existing.ticketNumber,
                message: 'This wallet has already claimed its Genesis Ticket.',
            }, { status: 409 });
        }

        //  Supply gate 
        // NOTE: Interactive transactions fail over PgBouncer (Allocation failure).
        // Using sequential operations to guarantee 100% operational success.
        const totalClaimed = await (prisma as any).goldenTicket.count();
        if (totalClaimed >= MAX_SUPPLY) {
            throw new Error('MAX_SUPPLY_REACHED');
        }

        // Ensure the User row exists. It used to also set isZkVerified = true:
        // signing one fixed message (or holding a session) then showed a
        // "verified" badge next to the account in contacts and search, with
        // no proof of personhood behind it. Same fix as auth/kyc-verify.
        const user = await (prisma as any).user.upsert({
            where: { walletAddress: address },
            update: {},
            create: { walletAddress: address }
        });

        // ── Identity Claim — Free Mint (ECDSA or Session verified) ───────────
        // The Gold Identity claim is free — it is a cryptographic proof of wallet
        // ownership, not a payment transaction.  ECDSA-verified claims have already
        // passed the verifyMessage check above.  SESSION_AUTH claims are proven by
        // the HTTP session cookie (SIWE-backed).
        // One-ticket-per-wallet Sybil resistance is enforced by the DB unique check above.
        const isSessionAuth = cryptoSignature === 'SESSION_AUTH';

        let paymentVerified = true;   // Always true — mint is free
        let paymentGraceMode = false;

        console.log(JSON.stringify({
            level: 'INFO',
            event: isSessionAuth ? 'SESSION_AUTH_CLAIM' : 'ECDSA_CLAIM',
            address,
            txHash: txHash || null,
        }));

        //  Create ticket using standard Prisma methods 
        const tempSerial = `PENDING-${address}-${Date.now()}`;
        
        // --- 🔴 Aztec Mainnet Verification Anchoring ---
        let aztecBlockNum = 0;
        let aztecExplorerUrl = '';
        try {
            const nodeUrl = process.env.AZTEC_NODE_URL || 'https://node.aztec.network';
            const nodeInfoRes = await fetch(`${nodeUrl}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'node_getBlockNumber', params: [], id: 1 }),
                signal: AbortSignal.timeout(3000),
            });
            if (nodeInfoRes.ok) {
                const nodeData = await nodeInfoRes.json();
                aztecBlockNum = nodeData?.result || 0;
                // In Virtualized mode, do not link to AztecScan to avoid confusing the user with a homepage link
                aztecExplorerUrl = '';
            }
        } catch (e) {
            console.warn('[GoldenTicket] Failed to anchor to Aztec Mainnet block:', e);
        }

        // Pack on-chain mint details into signatureData JSON
        let packedSignatureData = safeSignatureData;
        try {
            const parsed = JSON.parse(signatureData);
            packedSignatureData = JSON.stringify({
                signature: parsed.signature || signatureData,
                timestamp: parsed.timestamp || new Date().toISOString(),
                txHash: txHash || parsed.txHash || null,
                cryptoSignature: cryptoSignature || parsed.cryptoSignature || null,
                aztecExplorerUrl: aztecExplorerUrl || undefined
            });
        } catch {
            packedSignatureData = JSON.stringify({
                signature: signatureData,
                timestamp: new Date().toISOString(),
                txHash: txHash || null,
                cryptoSignature: cryptoSignature || null,
                aztecExplorerUrl: aztecExplorerUrl || undefined
            });
        }

        const initialTicket = await (prisma as any).goldenTicket.create({
            data: {
                userAddress: address,
                serialCode: tempSerial,
                tier: 'GENESIS',
                badgeColor: 'GOLD',
                networkLaunchEligible: true,
                twitterHandle: safeHandle,
                signatureData: packedSignatureData,
                isActive: true
            }
        });

        // Update with final formatted serial code based on the generated ticketNumber
        const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
        const finalSerial = `TICKET ${initialTicket.ticketNumber} by ${shortAddr}`;
        let finalTicket = await (prisma as any).goldenTicket.update({
            where: { id: initialTicket.id },
            data: { serialCode: finalSerial }
        });

        //  Absolute Atomic Supply Check (Anti-TOCTOU) 
        if (finalTicket.ticketNumber > MAX_SUPPLY) {
            await (prisma as any).$executeRaw`
                DELETE FROM "GoldenTicket" WHERE id = ${finalTicket.id}
            `;
            console.warn(JSON.stringify({ level: 'SECURITY', event: 'OVERMINT_PREVENTED', address, ticketNumber: finalTicket.ticketNumber }));
            throw new Error('MAX_SUPPLY_REACHED');
        }

        console.log(JSON.stringify({
            level: 'INFO', event: 'GOLDEN_TICKET_CLAIMED',
            address, ticketNumber: finalTicket.ticketNumber, serialCode: finalTicket.serialCode,
            txHash: txHash || null,
            paymentVerified,
            paymentGraceMode,
        }));

        return NextResponse.json({
            success:         true,
            ticket:          finalTicket,
            serial:          finalTicket.ticketNumber,
            totalClaimed:    totalClaimed + 1,
            paymentVerified,
            paymentGraceMode,
            message:         'Ledger Gold Ticket claimed successfully.',
        }, { status: 201 });

    } catch (error: any) {
        if (error?.message === 'MAX_SUPPLY_REACHED') {
            return NextResponse.json({
                error: 'Max supply reached. All 200 Ledger Gold Tickets have been minted.',
            }, { status: 410 });
        }
        if (error?.code === 'P2002') {
            return NextResponse.json({
                success: false, alreadyClaimed: true,
                message: 'This wallet has already claimed its Genesis Ticket.',
            }, { status: 409 });
        }
        console.error('[Golden Ticket POST Error]', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// 
// GET /api/golden-ticket/claim
// ?address=0x...   per-wallet status + global supply
// (no address)     global supply stats only (for public counter)
// 
export async function GET(req: NextRequest) {
    try {
        const address = req.nextUrl.searchParams.get('address')?.toLowerCase();

        let totalClaimed = 0;
        let remaining = MAX_SUPPLY;
        let feedRaw: any[] = [];

        // REDIS EDGE CACHING LAYER
        const CACHE_KEY = 'global_ledger_stats_v2';
        const cachedStr = await safeRedisGet(CACHE_KEY);
        
        if (cachedStr && cachedStr !== 'TIMEOUT') {
            try {
                const parsed = JSON.parse(cachedStr);
                totalClaimed = parsed.totalClaimed;
                remaining = parsed.remaining;
                feedRaw = parsed.feedRaw;
            } catch (e) {
                // Ignore parse error and fallback to DB
            }
        }

        if (feedRaw.length === 0) {
            // DB Fallback / Cache Miss
            totalClaimed = await (prisma as any).goldenTicket.count();
            remaining    = Math.max(0, MAX_SUPPLY - totalClaimed);
            feedRaw = await (prisma as any).goldenTicket.findMany({
                where:   { isActive: true },
                select: {
                    userAddress:            true,
                    ticketNumber:           true,
                    claimedAt:              true,
                    signatureData:          false,
                    serialCode:             true,
                    tier:                   true,
                    badgeColor:             true,
                    networkLaunchEligible:  true,
                    twitterHandle:          true,
                },
                orderBy: { claimedAt: 'desc' },
                take: 1000, // Fetch up to 1000 for the global ledger feed
            });

            // Cache for 2 seconds to enable real-time feed while shielding DB
            await safeRedisSet(CACHE_KEY, JSON.stringify({ totalClaimed, remaining, feedRaw }), 'EX', 2);
        }

        if (!address) {
            return NextResponse.json({
                hasClaimed: false, ticket: null,
                totalClaimed, remaining, maxSupply: MAX_SUPPLY, feed: feedRaw,
            });
        }

        // Individual Query (Not cached globally, highly specific and lightweight)
        const ticket = await (prisma as any).goldenTicket.findUnique({
            where:  { userAddress: address },
            select: {
                id: true, ticketNumber: true, serialCode: true, tier: true,
                badgeColor: true, networkLaunchEligible: true, twitterHandle: true,
                isActive: true, claimedAt: true,
            },
        });

        return NextResponse.json({
            hasClaimed:   !!ticket,
            ticket:       ticket || null,
            serial:       ticket?.ticketNumber ?? null,
            totalClaimed,
            remaining,
            maxSupply: MAX_SUPPLY,
            feed: feedRaw,
        });

    } catch (error) {
        console.error('[Golden Ticket GET Error]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
