/**
 * GET /api/powered-by
 *
 * "Powered by Humanity Ledger" Integration Registry
 *
 * Serves metadata for the dApps/protocols that have integrated
 * Humanity Ledger as their on-chain analytics layer.
 *
 * Also acts as registration endpoint for new integrators.
 *
 * POST /api/powered-by
 *   Body: { projectName, projectUrl, description, contactEmail, apiKeyTier }
 *   Returns: integration credentials + iframe embed snippet
 *
 * Public registry is visible at /ecosystem  encourages ecosystem growth
 * without revealing system detection methodology.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

//  Featured Integrations (curated showcase) 

const FEATURED_INTEGRATIONS = [
    {
        id:          'ledger-alert-native',
        name:        'Humanity Ledger',
        url:         'https://humanidfi.com',
        description: 'The system terminal. EVM Thermodynamics engine, ZK identity layer, sovereign analytics.',
        category:    'analytics',
        tier:        'Private',
        since:       '2026-01-01',
        logo:        '/logo.png',
        badge:       ' Core Platform',
        features:    ['Real-time ledger detection', 'ZK identity', 'Dead Man Switch', 'API Marketplace'],
    },
];

//  GET  Integration Registry 

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const category         = searchParams.get('category');

    try {
        const { prisma } = await import('@/lib/prisma');

        // Try to read from DB-registered integrations
        let dbIntegrations: any[] = [];
        try {
            dbIntegrations = await (prisma as any).poweredByIntegration?.findMany?.({
                where:   {
                    approved: true,
                    ...(category ? { category } : {}),
                },
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true, name: true, url: true, description: true,
                    category: true, tier: true, logo: true, since: true,
                },
            }) ?? [];
        } catch {}

        const allIntegrations = [
            ...FEATURED_INTEGRATIONS.filter(i => !category || i.category === category),
            ...dbIntegrations,
        ];

        return NextResponse.json({
            total:        allIntegrations.length,
            integrations: allIntegrations,
            embedSnippet: `<script src="https://humanidfi.com/sdk/powered-by.js" data-theme="light" async></script>`,
            registerUrl:  '/api/powered-by',
            badgeAssets: {
                dark:  'https://humanidfi.com/badges/powered-by-dark.svg',
                light: 'https://humanidfi.com/badges/powered-by-light.svg',
                mini:  'https://humanidfi.com/badges/powered-by-mini.svg',
            },
        }, {
            headers: { 'Cache-Control': 'public, max-age=120' }
        });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Registry unavailable', detail: err?.message },
            { status: 503 }
        );
    }
}

//  POST  Register Integration 

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { projectName, projectUrl, description, contactEmail, apiKeyTier = 'PRO' } = body;

        if (!projectName || !projectUrl || !contactEmail) {
            return NextResponse.json(
                { error: 'projectName, projectUrl, and contactEmail are required' },
                { status: 400 }
            );
        }

        // Validate URL format
        try { new URL(projectUrl); } catch {
            return NextResponse.json({ error: 'Invalid projectUrl' }, { status: 400 });
        }

        // Generate integration credentials
        const integrationId = `int_${projectName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}_${Date.now().toString(36)}`;
        const embedKey      = `pwby_${Buffer.from(`${integrationId}:${Date.now()}`).toString('base64').slice(0, 32)}`;

        const { prisma } = await import('@/lib/prisma');

        // Persist to DB (graceful fallback if table missing)
        try {
            await (prisma as any).poweredByIntegration.create({
                data: {
                    id:           integrationId,
                    name:         projectName.slice(0, 100),
                    url:          projectUrl,
                    description:  description?.slice(0, 500) ?? '',
                    contactEmail: contactEmail.slice(0, 200),
                    category:     'dapp',
                    tier:         apiKeyTier,
                    approved:     false, // Requires manual review
                    embedKey,
                },
            });
        } catch {
            console.log(`[PoweredBy] Registration: ${projectName} (${projectUrl})  pending review`);
        }

        return NextResponse.json({
            success:        true,
            integrationId,
            embedKey,
            approved:       false,
            reviewTime:     '24-48 hours',
            embedSnippet:   `<script src="https://humanidfi.com/sdk/powered-by.js" data-key="${embedKey}" data-theme="light" async></script>`,
            badgeMarkdown:  `[![Powered by Humanity Ledger](https://humanidfi.com/badges/powered-by-light.svg)](https://humanidfi.com?ref=${integrationId})`,
            nextSteps: [
                'Add the badge to your README and UI',
                'Our team will review and approve within 48h',
                `Join @HumanidFi to announce your integration`,
            ],
        });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Registration failed', detail: err?.message },
            { status: 500 }
        );
    }
}
