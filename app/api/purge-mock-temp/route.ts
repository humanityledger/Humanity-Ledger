import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';

export async function GET(req: Request) {
    const address = (req as any).headers?.get?.('x-verified-session-address') || '';
    if (!isAdmin(address)) {
        return NextResponse.json({ error: 'Admin only — 403 Forbidden' }, { status: 403 });
    }
    try {
        const users = await prisma.user.findMany({
            where: {
                bio: {
                    contains: 'Managing tier-1 liquidity on EVM.'
                }
            }
        });

        const userIds = users.map((u: any) => u.id);
        
        if (userIds.length === 0) {
            return NextResponse.json({ success: true, message: "No mock users found." });
        }

        await prisma.blockchainTransaction.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });

        return NextResponse.json({ success: true, purged: userIds.length });
    } catch (error: any) {
        console.error('[purge-mock-temp]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
