import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const events = await (prisma as any).forumTelemetry.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                action: true,
                createdAt: true,
                userId: true,
                metadata: true
            }
        });

        return NextResponse.json({ success: true, events });
    } catch (e: any) {
        // Fallback for missing table/schema mismatch gracefully
        console.warn("[Telemetry Active Error]:", e.message);
        
        // Return clean empty array if table is missing, no fake data
        return NextResponse.json({ success: true, events: [] });
    }
}
