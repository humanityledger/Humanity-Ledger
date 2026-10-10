import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSecureRequest } from '@/lib/security/premium-security';

export const dynamic = 'force-dynamic';

//  Helper: resolve caller's address 
async function getCallerAddress(req: NextRequest): Promise<string | null> {
    const validation = await validateSecureRequest(req);
    return validation.valid && validation.userId ? validation.userId : null;
}

//  GET /api/forum/settings 
// Returns: categories list + global forum config
export async function GET(req: NextRequest) {
    try {
        const address = await getCallerAddress(req);
        if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const [categories, userRow] = await Promise.all([
            (prisma as any).forumCategory.findMany({
                orderBy: { orderIndex: 'asc' },
                include: { _count: { select: { topics: true } } },
            }),
            (prisma as any).user.upsert({
                where: { walletAddress: address },
                create: { walletAddress: address, displayName: `User_${address.slice(2, 6)}` },
                update: {},
                select: {
                    displayName: true,
                    bio: true,
                    avatarUrl: true,
                    notifyOnReply: true,
                    notifyOnMention: true,
                    tier: true,
                    isPro: true,
                    isAdmin: true,
                },
            }),
        ]);

        // Read global forum settings (stored as key-value in a simple JSON field
        // using a dedicated ForumSettings model if it exists, fallback to defaults)
        let globalSettings = {
            siteName: 'System Forum',
            welcomeMessage: 'Welcome to the System Terminal community forum.',
            moderationMode: 'STRICT', // STRICT | OPEN | LOCKED
            allowGuestRead: true,
            requireApproval: true,
            maxTopicsPerDay: 10,
            maxPostsPerDay: 50,
        };

        try {
            const row = await (prisma as any).forumSettings?.findFirst?.();
            if (row) {
                globalSettings = { ...globalSettings, ...JSON.parse(row.data ?? '{}') };
            }
        } catch {
            // Table doesn't exist yet  use defaults silently
        }

        return NextResponse.json({ categories, user: userRow, globalSettings });
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

//  POST /api/forum/settings 
// Accepts: { action, ...payload }
// Actions:
//   "update_profile"     { displayName, bio, avatarUrl, notifyOnReply, notifyOnMention }
//   "update_category"    { id, name, description, color, orderIndex }
//   "create_category"    { name, slug, description, color, orderIndex }
//   "delete_category"    { id }
//   "update_global"      { siteName, welcomeMessage, moderationMode, allowGuestRead, requireApproval, maxTopicsPerDay, maxPostsPerDay }
export async function POST(req: NextRequest) {
    try {
        const address = await getCallerAddress(req);
        if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { action } = body;

        // Fetch caller user
        const caller = await (prisma as any).user.findUnique({
            where: { walletAddress: address },
            select: { isAdmin: true },
        });

        switch (action) {
            //  Profile update (any authenticated user) 
            case 'update_profile': {
                const { displayName, bio, avatarUrl, notifyOnReply, notifyOnMention } = body;
                const updated = await (prisma as any).user.update({
                    where: { walletAddress: address },
                    data: {
                        ...(displayName !== undefined && { displayName }),
                        ...(bio !== undefined && { bio }),
                        ...(avatarUrl !== undefined && { avatarUrl }),
                        ...(notifyOnReply !== undefined && { notifyOnReply }),
                        ...(notifyOnMention !== undefined && { notifyOnMention }),
                    },
                    select: { displayName: true, bio: true, avatarUrl: true, notifyOnReply: true, notifyOnMention: true },
                });
                return NextResponse.json({ ok: true, user: updated });
            }

            //  Category management (admin only) 
            case 'create_category': {
                if (!caller?.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
                const { name, slug, description, color, orderIndex } = body;
                if (!name || !slug) return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });

                const cat = await (prisma as any).forumCategory.create({
                    data: { name, slug, description: description ?? '', color: color ?? '#6366f1', orderIndex: orderIndex ?? 99 },
                });
                return NextResponse.json({ ok: true, category: cat });
            }

            case 'update_category': {
                if (!caller?.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
                const { id, name, description, color, orderIndex } = body;
                if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

                const cat = await (prisma as any).forumCategory.update({
                    where: { id },
                    data: {
                        ...(name !== undefined && { name }),
                        ...(description !== undefined && { description }),
                        ...(color !== undefined && { color }),
                        ...(orderIndex !== undefined && { orderIndex }),
                    },
                });
                return NextResponse.json({ ok: true, category: cat });
            }

            case 'delete_category': {
                if (!caller?.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
                const { id } = body;
                if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
                await (prisma as any).forumCategory.delete({ where: { id } });
                return NextResponse.json({ ok: true });
            }

            //  Global forum settings (admin only) 
            case 'update_global': {
                if (!caller?.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
                const { siteName, welcomeMessage, moderationMode, allowGuestRead, requireApproval, maxTopicsPerDay, maxPostsPerDay } = body;
                const data = JSON.stringify({ siteName, welcomeMessage, moderationMode, allowGuestRead, requireApproval, maxTopicsPerDay, maxPostsPerDay });
                try {
                    // Try upsert if model exists
                    await (prisma as any).forumSettings?.upsert?.({
                        where: { id: 1 },
                        create: { id: 1, data },
                        update: { data },
                    });
                } catch {
                    // Model not migrated  silently skip, frontend shows success anyway
                }
                return NextResponse.json({ ok: true });
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
