import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSecureRequest } from '@/lib/security/premium-security';

/**
 * POST /api/wallets/sync
 * PERSISTENCE LAYER: Saves locally generated wallets to the user's account.
 */
export async function POST(req: NextRequest) {
    try {
        const validation = await validateSecureRequest(req);
        if (!validation.valid || !validation.userId) {
            return NextResponse.json({ error: 'Identity not initialized' }, { status: 401 });
        }
        const userAddress = validation.userId;

        const { wallets } = await req.json(); // { address: string, label: string }[]

        // Hard cap: prevent DoS via massive wallet array injection
        if (!Array.isArray(wallets) || wallets.length > 50) {
            return NextResponse.json({ error: 'Invalid or oversized wallet list (max 50)' }, { status: 400 });
        }

        // Find or Create user with Race Condition protection
        let newlyCreated = false;
        let user = await prisma.user.findUnique({
            where: { walletAddress: userAddress }
        });

        if (!user) {
            try {
                user = await prisma.user.create({
                    data: { walletAddress: userAddress }
                });
                newlyCreated = true;
            } catch (e) {
                user = await prisma.user.findUnique({
                    where: { walletAddress: userAddress }
                });
            }
        }

        // A "genesis airdrop" used to fire here: with PRIVATE_KEY and a token
        // contract configured, the server signed a mint of 500 QD to every new
        // account, paying gas from a hot key for anyone who made a wallet.
        // Humanity Ledger has no token (QD retired 23 Oct 2026); removed.
        void newlyCreated;

        if (!user) {
            throw new Error('User creation failed catastrophically');
        }

        // Only well-formed addresses and short labels are stored.
        const valid = wallets.filter((w: any) =>
            w && typeof w.address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(w.address) &&
            (w.label === undefined || typeof w.label === 'string'));
        if (valid.length !== wallets.length) {
            return NextResponse.json({ error: 'Each wallet needs an EVM address and an optional text label' }, { status: 400 });
        }
        // Upsert wallets into WatchedWallet
        for (const w of valid.map((x: any) => ({ address: x.address.toLowerCase(), label: x.label ? String(x.label).slice(0, 64) : undefined }))) {
            await prisma.watchedWallet.upsert({
                where: { 
                    userId_address: {
                        userId: user.id,
                        address: w.address
                    }
                },
                create: {
                    userId: user.id,
                    address: w.address,
                    label: w.label || 'Generated Intel'
                },
                update: {
                    label: w.label || 'Generated Intel'
                }
            });
        }

        // Clean up duplicates (simplified for this context)
        // In a real 50-trillion-param system, we would have a @@unique([userId, walletAddress])

        return NextResponse.json({ success: true, count: wallets.length });

    } catch (error: any) {
        console.error('[WALLET-SYNC-POST]  Failure:', error.message);
        return NextResponse.json({ error: 'Cloud synchronization failed' }, { status: 500 });
    }
}

/**
 * GET /api/wallets/sync
 * RESTORATION LAYER: Fetches all saved wallets for the current identity.
 */
export async function GET(req: NextRequest) {
    try {
        const validation = await validateSecureRequest(req);
        if (!validation.valid || !validation.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userAddress = validation.userId;

        const user = await prisma.user.findUnique({
            where: { walletAddress: userAddress },
            include: {
                // WatchedWallet is not explicitly related in the schema I saw, 
                // but we can query it directly.
            }
        });

        if (!user) return NextResponse.json({ wallets: [] });

        const wallets = await prisma.watchedWallet.findMany({
            where: { userId: user.id }
        });

        return NextResponse.json({ 
            wallets: wallets.map(w => ({
                address: w.address,
                label: w.label
            }))
        });

    } catch (error: any) {
        console.error('[WALLET-SYNC-GET]  Failure:', error.message);
        return NextResponse.json({ error: 'Identity restoration failed' }, { status: 500 });
    }
}
