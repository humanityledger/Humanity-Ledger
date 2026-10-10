import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_PRIVACY_FIELDS = new Set([
  'logLevel', 'dataSharing', 'sessionAutoLogout', 'ipWhitelist', 
  'twoFAEnabled', 'systemVisibility', 'exportEncryption'
]);

/** GET /api/privacy/settings */
export async function GET(request: NextRequest) {
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ success: false, profile: null, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.userId;
    try {
        const profile = await (prisma as any).userPrivacyProfile.findUnique({ where: { userId } });
        return NextResponse.json({ success: true, profile });
    } catch (error) {
        console.error('[Privacy API] GET failed:', error);
        return NextResponse.json({ success: false, profile: null }, { status: 500 });
    }
}

/** POST /api/privacy/settings  body: { field, value } */
export async function POST(request: NextRequest) {
    try {
        const { getSession } = await import('@/lib/session');
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        const userId = session.userId;

        const { field, value } = await request.json();
        if (!field || typeof field !== 'string' || !ALLOWED_PRIVACY_FIELDS.has(field)) {
            return NextResponse.json({ success: false, error: 'Invalid field' }, { status: 400 });
        }

        const profile = await (prisma as any).userPrivacyProfile.upsert({
            where:  { userId },
            update: { [field]: value },
            create: { userId, [field]: value },
        });

        // Non-fatal audit log
        try {
            await (prisma as any).userSessionLog.create({
                data: {
                    userId,
                    sessionId: `session-${crypto.randomUUID().substring(0, 8)}`,
                    action:     'PRIVACY_SETTINGS_UPDATE',
                    entityType: 'setting',
                    entityId:   field,
                    ipAddress:  request.headers.get('x-forwarded-for') ?? 'unknown',
                    userAgent:  request.headers.get('user-agent') ?? 'unknown',
                    metadata:   { newValue: value },
                },
            });
        } catch { /* Audit log failure must never break the response */ }

        return NextResponse.json({ success: true, profile });
    } catch (error) {
        console.error('[Privacy API] POST failed:', error);
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
    }
}
