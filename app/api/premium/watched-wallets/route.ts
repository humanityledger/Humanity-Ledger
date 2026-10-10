import { NextRequest, NextResponse } from 'next/server';
import { getLegendaryStats } from '@/lib/stats-engine';
import {
  validateSecureRequest,
  logAuditEvent,
  sanitizeInput,
  watermarkData,
  validateWalletAddress,
  logSecurityEvent,
} from '@/lib/security/premium-security';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  try {
    const validation = await validateSecureRequest(req);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    const userId = validation.userId!;
    const body = await req.json();
    const address = sanitizeInput(body.address).toLowerCase();
    const label = sanitizeInput(body.label || '');

    if (!validateWalletAddress(address)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    // 1. MASTER SECURITY: Tier-Based Wallet Limits
    const user = await prisma.user.upsert({
        where: { walletAddress: userId },
        create: { walletAddress: userId, tier: 'HUMAN', lastActive: new Date() },
        update: { lastActive: new Date() },
        select: { id: true, tier: true }
    });
    const userUuid = user.id;

    // Cast to any to bypass stale prisma client type overlap error if present
    const userTier = (user?.tier as any);
    const isPremium = userTier === 'Private' || userTier === 'HUMAN';
    
    if (!isPremium) {
        const walletCount = await prisma.watchedWallet.count({
            where: { userId: userUuid }
        });

        if (walletCount >= 3) {
            console.warn(`[SECURITY-GATE] Blocked wallet addition for free user ${userId}. Count: ${walletCount}`);
            
            await logSecurityEvent('PREMIUM_LIMIT_REACHED', {
                userId,
                address,
                currentCount: walletCount,
                severity: 'WARNING',
                reason: 'Free tier 3-wallet limit exceeded'
            });

            return NextResponse.json({ 
                error: 'LIMIT_REACHED',
                message: 'Has alcanzado el límite de 3 carteras para usuarios gratuitos. Activa el acceso Private por 1.50 para tener carteras ilimitadas.',
                requirePremium: true
            }, { status: 403 });
        }
    }

    // 2. DISCOVERY Level: Senior (With Resilience)
    let stats = null;
    if (address.startsWith('0x')) {
        try {
            //  [LEGENDARY DISCOVERY] Force Deep Scan on addition to prevent 0.00 balance lag
            stats = await getLegendaryStats(address, true);
        } catch (statsError) {
            console.warn(`[WATCH-ADD] getLegendaryStats failed for ${address}:`, statsError);
            // Continue with wallet creation - stats will be fetched on next GET request
        }
    }

    const totalValue = stats?.totalValue || 0;
    const metadata = stats?.breakdown || {};

    console.log(`[POST-WALLET] Adding wallet for userId: ${userId}, address: ${address}, label: ${label || 'Anonymous Ledger'}`);

    // 2. Persist with Advanced Resilience [SENIOR-LEVEL ATOMICITY]
    try {
        const wallet = await prisma.$transaction(async (tx) => {
            const newWallet = await tx.watchedWallet.upsert({
                where: { userId_address: { userId: userUuid, address } },
                update: { label, lastValue: totalValue, metadata: metadata as any, lastCheck: new Date() },
                create: { userId: userUuid, address, label, lastValue: totalValue, metadata: metadata as any, tags: body.tags || [] }
            });

            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'WATCH_WALLET_ADDED',
                    resource: 'watched_wallet',
                    metadata: { address, label, totalValue, walletId: newWallet.id } as any,
                    timestamp: new Date(),
                }
            });

            return newWallet;
        });

        console.log(`[POST-WALLET] Successfully added wallet ${wallet.id} for user ${userId}`);
        return NextResponse.json(watermarkData(wallet, userId));
    } catch (prismaErr: any) {
        // DETECT CONNECTION ERRORS (P1001, P1002, etc)
        const isConnError = prismaErr.message?.includes('Can\'t reach database server') || prismaErr.code?.startsWith('P100');
        
        if (isConnError) {
            console.error(`[PLANET-SCALE-RESILIENCE] Database unreachable. Realtime sync degraded.`);
            return NextResponse.json({ error: 'DB_UNREACHABLE', syncStatus: 'FAILED' }, { status: 503 });
        }
        
        throw prismaErr; // Re-throw if it's a different error
    }

  } catch (error: any) {
    console.error('[POST-WATCH-ERROR]', error);
    return NextResponse.json({ 
        error: 'Grid Resilience Active', 
        details: 'Error details redacted' || 'The blockchain data was discovered, but the database synchronization failed. Your view is live but changes may not persist.',
        syncStatus: 'FAILED'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const validation = await validateSecureRequest(req);
    if (!validation.valid) {
     return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    const userId = validation.userId!;
    
    // Resolve primary User UUID from walletAddress
    const primaryUser = await prisma.user.findUnique({
        where: { walletAddress: userId },
        select: { id: true }
    });
    const primaryUuid = primaryUser?.id || userId;
    const userUuids = [primaryUuid];

    const wallets = await prisma.watchedWallet.findMany({
      where: { userId: { in: userUuids } },
      orderBy: { createdAt: 'desc' },
    });

    // [PHASE 4] Fetch Global Analytics for these addresses to merge missing forensics/categories
    const addresses = wallets.map(w => w.address.toLowerCase());
    const globalIntels = await (prisma.walletAnalytics as any).findMany({
        where: { address: { in: addresses } },
        select: { address: true, forensics: true, category: true }
    });
    const intelMap = Object.fromEntries(globalIntels.map((i: any) => [i.address.toLowerCase(), i]));

    // REVELATION: Senior Level Bulk Enrichment
    // If the cache is fresh, users get real-time stats for the entire list instantly.
    const enrichedWallets = await Promise.all(
        wallets.map(async (w) => {
            const addrLower = w.address.toLowerCase();
            const globalIntel = intelMap[addrLower];

            if (addrLower.startsWith('0x')) {
                // Fetch legacy stats only (Analytics fetched on-demand in UI)
                const stats = await getLegendaryStats(w.address).catch(() => null);
                
                if (stats) {
                    //  PERSISTENCE FLOOR: Never return 0 if DB has a high lastValue and stats are fresh-0
                    const dbValue = w.lastValue || 0;
                    const totalValue = stats ? ((stats.totalValue === 0 && dbValue > 0) ? dbValue : stats.totalValue) : dbValue;
                    
                    // Background  Sync: Update DB if we got real fresh data
                    if (stats && !stats.fromCache && stats.totalValue > 0) {
                        prisma.watchedWallet.update({
                            where: { id: w.id },
                            data: { 
                                lastValue: stats.totalValue, 
                                metadata: stats.breakdown as any,
                                lastCheck: new Date()
                            }
                        }).catch(e => console.error("Background DB sync failed", e));
                    }

                    return {
                        ...w,
                        totalValue: totalValue,
                        change24h: stats?.change24h || 0,
                        lastActive: stats?.lastActive || new Date(),
                        legendaryScore: stats?.legendaryScore || 50,
                        riskScore: stats?.riskScore || 50,
                        activityScore: (stats as any)?.activityScore || 20,
                        error: (stats as any)?.error,
                        errorMessage: (stats as any)?.errorMessage,
                        tokens: stats?.tokens || [],
                        metadata: stats?.breakdown,
                        forensics: (w as any).forensics || (globalIntel as any)?.forensics || undefined,
                        category: (w as any).category || (globalIntel as any)?.category || undefined,
                        //  MODIFIED: Analytics now fetched on-demand via separate API
                        analytics: undefined
                    };
                }
            }
            
            //  FIX: If stats failed or wallet is not 0x, still return totalValue from DB
            return {
                ...w,
                totalValue: w.lastValue || 0,
                change24h: 0,
                pnl24h: 0,
                txCount: 0,
                riskScore: 50,
                rank: null,
                activityScore: 0
            };
        })
    );

    console.log(`[GET-WALLETS] Returning ${enrichedWallets.length} enriched wallets`);

    return NextResponse.json({
      wallets: enrichedWallets.map(w => watermarkData(w, userId)),
      count: enrichedWallets.length,
    });
  } catch (error) {
    console.error('[GET-WATCH-ERROR]', error);
    return NextResponse.json({ wallets: [], count: 0, error: 'Failed to load' });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    console.log('[DELETE-WALLET] Starting deletion request');
    
    const validation = await validateSecureRequest(req);
    console.log('[DELETE-WALLET] Validation result:', { valid: validation.valid, userId: validation.userId, error: validation.error });
    
    if (!validation.valid) {
      console.error('[DELETE-WALLET] Validation failed:', validation.error);
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    const userId = validation.userId!;
    const { searchParams } = new URL(req.url);
    const walletId = searchParams.get('id');

    console.log('[DELETE-WALLET] Request params:', { userId, walletId });

    if (!walletId) {
      console.error('[DELETE-WALLET] Missing wallet ID');
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    //  [IDENTITY FUSION] Strict cryptographically verified user
    const userIds = [userId];

    // First, try to find the wallet
    const wallet = await prisma.watchedWallet.findFirst({
      where: { 
        id: walletId, 
        userId: { in: userIds }
      },
    });

    console.log('[DELETE-WALLET] Wallet lookup result:', wallet ? { id: wallet.id, address: wallet.address, userId: wallet.userId } : 'NOT FOUND');

    if (!wallet) {
      console.error('[DELETE-WALLET] Wallet not found or unauthorized:', { walletId, userId });
      return NextResponse.json({ 
        error: 'Wallet not found or unauthorized',
        details: `WalletID: ${walletId}, UserID: ${userId}`
      }, { status: 404 });
    }

    console.log('[DELETE-WALLET] Starting transaction to delete wallet:', walletId);

    // [SENIOR-LEVEL ATOMICITY]
    // Ensure deletion and logging happen together.
    await prisma.$transaction(async (tx) => {
        console.log('[DELETE-WALLET] Deleting wallet from database...');
        await tx.watchedWallet.delete({ where: { id: walletId } });
        console.log('[DELETE-WALLET] Wallet deleted successfully');

        console.log('[DELETE-WALLET] Creating audit log...');
        await tx.auditLog.create({
            data: {
                userId,
                action: 'WATCH_WALLET_DELETED',
                resource: 'watched_wallet',
                metadata: { walletId, address: wallet.address } as any,
                timestamp: new Date()
            }
        });
        console.log('[DELETE-WALLET] Audit log created successfully');
    });

    console.log('[DELETE-WALLET] Transaction completed successfully');
    return NextResponse.json({ success: true, message: 'Wallet deleted successfully' });
    
  } catch (error: any) {
    console.error('[DELETE-WALLET] Critical error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Return detailed error for debugging
    return NextResponse.json({ 
      error: 'Failed to delete wallet',
      details: 'Error details redacted',
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

