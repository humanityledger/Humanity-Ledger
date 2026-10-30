import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/jwt';
import { requireAdmin } from '@/lib/admin-guard';

// Simple admin authentication check
async function isAdminAuthenticated(request: NextRequest): Promise<boolean> {
    const deny = requireAdmin(request);
    if (!deny) return true;

    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token');

    if (!adminToken) {
        return false;
    }

    try {
        const payload = await verifyJWT(adminToken.value);
        // [SECURITY FIX] Must strictly verify the role inside the payload.
        // Otherwise, a normal user's valid session JWT would bypass this check.
        if (payload.role !== 'admin' && payload.role !== 'superadmin') {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export async function GET(request: NextRequest) {
    // Check admin authentication
    const isAuthenticated = await isAdminAuthenticated(request);
    if (!isAuthenticated) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const rawLimit = parseInt(searchParams.get('limit') || '100');
    const limit = Math.min(rawLimit, 500); // Hard cap at 500 to prevent DoS
    const rawOffset = parseInt(searchParams.get('offset') || '0');
    const offset = Math.max(0, rawOffset); // Prevent negative offset

    try {
        // Build where clause
        const where: any = {};
        if (type) where.type = type;
        if (severity) where.severity = severity;

        // Get events with pagination
        const events = await prisma.securityEvent.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: limit,
            skip: offset,
        });

        // Get total count
        const totalCount = await prisma.securityEvent.count({ where });

        // Get statistics
        const stats = await prisma.securityEvent.groupBy({
            by: ['type'],
            _count: true,
        });

        const severityStats = await prisma.securityEvent.groupBy({
            by: ['severity'],
            _count: true,
        });

        return NextResponse.json({
            events,
            totalCount,
            limit,
            offset,
            statistics: {
                byType: stats.map(s => ({ type: s.type, count: s._count })),
                bySeverity: severityStats.map(s => ({ severity: s.severity, count: s._count })),
            },
        });
    } catch (error) {
        console.error('Failed to fetch security events:', error);
        return NextResponse.json(
            { error: 'Failed to fetch security events' },
            { status: 500 }
        );
    }
}

