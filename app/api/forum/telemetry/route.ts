import { getSession } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Authentication required.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const address = session.userId.toLowerCase();
        let userId: string | undefined = undefined;
        try {
            const user = await prisma.user.findUnique({
                where: { walletAddress: address },
                select: { id: true }
            });
            if (user) userId = user.id;
        } catch { /* ignore */ }

        const body = await req.json();
        const { action, metadata } = body;
        const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';

        // Attempt to write telemetry  silently discard if table doesn't exist
        try {
            await (prisma as any).forumTelemetry.create({
                data: { userId, action, ipAddress, metadata: metadata || {} }
            });
        } catch {
            // ForumTelemetry table not yet created  run /api/admin/sync-db to fix
        }

        return NextResponse.json({ success: true });
    } catch {
        // Never error to client  telemetry is optional
        return NextResponse.json({ success: true });
    }
}
