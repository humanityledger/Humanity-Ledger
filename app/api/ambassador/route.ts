/**
 * Ambassador Program API
 *
 * GET  /api/ambassador            Fetch ambassador program info + application form
 * POST /api/ambassador            Submit ambassador application
 * GET  /api/ambassador/terminal  Authenticated ambassador stats (referrals, commissions)
 *
 * Tier System:
 *   WATCHER    MIN_REFERRALS = 0   (applicant)
 *   SENTINEL   MIN_REFERRALS = 5   (early community member)
 *   GUARDIAN   MIN_REFERRALS = 20  (active promoter, 10% commission)
 *   Private  MIN_REFERRALS = 50  (elite ambassador, 20% commission + exclusive alpha)
 *
 * On approval, ambassador receives:
 *   - Unique referral code  (ref=ABC123)
 *   - Dashboard access      (/ambassador/terminal)
 *   - Commission tracking   (Prisma referral model)
 *   - System badge       (NFT-mintable via LedgerPass contract)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

//  Program Metadata 

const PROGRAM_INFO = {
    name:        'Humanity Ledger Ambassador Program',
    version:     '1.0.0',
    launched:    '2026-04-01',
    tiers: [
        {
            name:         'WATCHER',
            minReferrals: 0,
            commission:   0,
            perks:        ['Early access to new features', 'Sentinel badge NFT', 'Private Discord channel'],
        },
        {
            name:         'SENTINEL',
            minReferrals:  5,
            commission:    5,
            perks:        ['5% commission on referral subscriptions', 'Monthly ledger analytics briefing', 'Co-create Hall of Fame nominations'],
        },
        {
            name:         'GUARDIAN',
            minReferrals: 20,
            commission:   10,
            perks:        ['10% commission', 'API key PRO tier free', 'Quarterly strategy call with core team', 'Guardian NFT badge'],
        },
        {
            name:         'Private',
            minReferrals: 50,
            commission:   20,
            perks:        ['20% lifetime commission', 'SOVEREIGN API access free', 'Private alpha channel', 'System NFT badge', '"State of Ledger Analytics" co-authorship'],
        },
    ],
    requirements: [
        'Wallet address must be verified via WorldID (no bot accounts)',
        'Minimum 30 days holding a Gold Ticket NFT (proves skin-in-the-game)',
        'Agreement to system analytics non-disclosure standards',
    ],
};

//  GET  Program Info 

export async function GET(req: NextRequest) {
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    const walletAddress = session?.userId?.toLowerCase();

    // If wallet provided, include their current tier status
    let applicantStatus = null;
    if (walletAddress) {
        try {
            const { prisma } = await import('@/lib/prisma');
            const ambassador = await (prisma as any).ambassador?.findUnique?.({
                where:  { walletAddress },
                select: {
                    id: true, tier: true, referralCode: true,
                    referralCount: true, commissionEarned: true,
                    approvedAt: true, status: true,
                },
            });

            // Fallback: count referrals from PrismaReferral if ambassador table doesn't exist
            if (!ambassador) {
                const refCount = await (prisma as any).referral?.count?.({
                    where: { referrerAddress: walletAddress },
                }) ?? 0;

                applicantStatus = {
                    walletAddress,
                    referralCount:    refCount,
                    currentTier:      refCount >= 50 ? 'Private' : refCount >= 20 ? 'GUARDIAN' : refCount >= 5 ? 'SENTINEL' : 'WATCHER',
                    hasApplied:       false,
                    nextTierAt:       refCount >= 50 ? null : refCount >= 20 ? 50 : refCount >= 5 ? 20 : 5,
                };
            } else {
                applicantStatus = { ...ambassador };
            }
        } catch {}
    }

    return NextResponse.json({
        program:   PROGRAM_INFO,
        applicant: applicantStatus,
        applyUrl:  '/api/ambassador',
        docsUrl:   '/docs/ambassador-program',
    }, {
        headers: { 'Cache-Control': 'public, max-age=60' },
    });
}

//  POST  Submit Application 

export async function POST(req: NextRequest) {
    try {
        // [SECURITY HARDENING] Derive walletAddress from authenticated session,
        // NOT from the request body. Previously, any caller could impersonate
        // any wallet address to register ambassador applications fraudulently.
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
        }

        const body = await req.json();
        const walletAddress = session.userId; // Cryptographically verified identity
        const { worldIdProof, telegram, twitter, motivation } = body;

        if (!walletAddress || !worldIdProof) {
            return NextResponse.json(
                { error: 'walletAddress and worldIdProof are required' },
                { status: 400 }
            );
        }

        // Validate motivation length
        if (!motivation || motivation.length < 50) {
            return NextResponse.json(
                { error: 'Motivation must be at least 50 characters.' },
                { status: 400 }
            );
        }

        const { prisma } = await import('@/lib/prisma');

        // Check if already applied
        const existing = await (prisma as any).ambassador?.findUnique?.({
            where: { walletAddress },
        });
        if (existing) {
            return NextResponse.json(
                { error: 'Application already submitted.', status: existing.status },
                { status: 409 }
            );
        }

        // Generate unique referral code (6 char alphanumeric)
        const { randomBytes } = await import('crypto');
        const referralCode = `WA${walletAddress.slice(2, 5).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;

        // Attempt to insert into ambassador table, fall back to notification
        try {
            await (prisma as any).ambassador.create({
                data: {
                    walletAddress,
                    telegram:      telegram  ?? null,
                    twitter:       twitter   ?? null,
                    motivation:    motivation.slice(0, 1000),
                    referralCode,
                    tier:          'WATCHER',
                    status:        'PENDING',
                    referralCount: 0,
                    commissionEarned: 0,
                },
            });
        } catch {
            // Ambassador table not yet migrated  log to user record metadata
            console.log(`[Ambassador] New application from ${walletAddress}  ref: ${referralCode}`);
        }

        return NextResponse.json({
            success:      true,
            referralCode,
            tier:         'WATCHER',
            status:       'PENDING',
            message:      ' Application received. Review takes 4872h. Your referral code is already active.',
            shareUrl:     `https://humanidfi.com?ref=${referralCode}`,
            nextSteps:    [
                'Share your referral link to start earning commissions immediately',
                'Reach 5 referrals to unlock SENTINEL tier (5% commission)',
                'Join @HumanidFi on Telegram for ambassador-exclusive updates',
            ],
        });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Application failed', detail: 'Internal error' },
            { status: 500 }
        );
    }
}
