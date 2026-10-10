import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const session = await getSession();
    const address = session?.userId;
        if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Ensure user is Pro or special admin (using isPro as basic check here)
        const user = await prisma.user.findUnique({ 
            where: { walletAddress: address },
            select: { id: true, isPro: true }
        });
        if (!user?.isPro) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const currentCount = await (prisma as any).forumCategory.count();
        if (currentCount > 0) {
            return NextResponse.json({ message: 'Categories already exist', count: currentCount });
        }

        const defaultCategories = [
            { name: 'General',    slug: 'general',    description: 'General discussion, announcements, and community updates.', color: '#00C076', orderIndex: 1 },
            { name: 'Developer',  slug: 'developer',  description: 'Technical discussions, smart contracts, bugs, and development topics.', color: '#9945FF', orderIndex: 2 },
            { name: 'Partnering', slug: 'partnering', description: 'Partnership proposals, collaboration opportunities, and integrations.', color: '#D4AF37', orderIndex: 3 },
        ];

        await (prisma as any).forumCategory.createMany({
            data: defaultCategories
        });

        return NextResponse.json({ success: true, message: 'Foundation categories initialized.' });
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
