import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_CATEGORIES = [
    { name: 'Humanity Ledger',  slug: 'ledger-network',  description: 'Core discussions about ledger movements, large transactions, and on-chain intelligence across all chains.', color: '#050505', orderIndex: 1 },
    { name: 'General',        slug: 'general',        description: 'General community discussions, announcements, and introductions.', color: '#0088cc', orderIndex: 2 },
    { name: 'Applications',   slug: 'applications',   description: 'Talk about dApps, DeFi protocols, tools, and ecosystem applications.', color: '#00C076', orderIndex: 3 },
    { name: 'Mainnets',       slug: 'mainnets',       description: 'Testing environments, devnet updates, and mainnet coordination.', color: '#F59E0B', orderIndex: 4 },
    { name: 'Noir',           slug: 'noir',           description: 'Zero-knowledge circuit development with Noir, proving systems, and ZK research.', color: '#7C3AED', orderIndex: 5 },
    { name: 'Site Feedback',  slug: 'site-feedback',  description: 'Report bugs, suggest improvements, and share feedback about Humanity Ledger.', color: '#64748B', orderIndex: 6 },
    { name: 'QDs Connect',    slug: 'qds-connect',    description: 'QDs ecosystem connectivity, integrations, and cross-platform collaboration.', color: '#EC4899', orderIndex: 7 },
    { name: 'Provenance',     slug: 'provenance',     description: 'Product passports, Humanity Provenance Framework, labels, GS1 Digital Link, and issuer discussion.', color: '#404040', orderIndex: 8 },
];

async function ensureDefaultCategories() {
    for (const cat of DEFAULT_CATEGORIES) {
        await (prisma as any).forumCategory.upsert({
            where: { slug: cat.slug },
            update: { name: cat.name, description: cat.description, orderIndex: cat.orderIndex, color: cat.color },
            create: { ...cat },
        });
    }

    // Remove any legacy categories not in the new list
    try {
        const legacyCategories = await (prisma as any).forumCategory.findMany({
            where: { slug: { notIn: DEFAULT_CATEGORIES.map(c => c.slug) } },
            select: { id: true },
        });
        if (legacyCategories.length > 0) {
            const legacyIds = legacyCategories.map((c: any) => c.id);
            const legacyTopics = await (prisma as any).forumTopic.findMany({
                where: { categoryId: { in: legacyIds } },
                select: { id: true },
            });
            const legacyTopicIds = legacyTopics.map((t: any) => t.id);
            if (legacyTopicIds.length > 0) {
                await (prisma as any).forumNotification.deleteMany({ where: { topicId: { in: legacyTopicIds } } });
                await (prisma as any).forumLike.deleteMany({ where: { topicId: { in: legacyTopicIds } } });
                await (prisma as any).forumPost.deleteMany({ where: { topicId: { in: legacyTopicIds } } });
                await (prisma as any).forumTopic.deleteMany({ where: { id: { in: legacyTopicIds } } });
            }
            await (prisma as any).forumCategory.deleteMany({ where: { id: { in: legacyIds } } });
        }
    } catch (e) {
        console.warn('[Forum] Legacy category cleanup error (non-fatal):', e);
    }
}

export async function GET() {
    try {
        await ensureDefaultCategories();

        const categories = await (prisma as any).forumCategory.findMany({
            orderBy: { orderIndex: 'asc' },
            include: {
                _count: { select: { topics: true } },
                topics: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        title: true,
                        createdAt: true,
                        author: { select: { walletAddress: true } }
                    }
                }
            }
        });

        return NextResponse.json(categories);
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
