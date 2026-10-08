// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/security/audit-log
 * Logs a security event to the database for SIEM/anomaly detection.
 * Only callable server-side (via middleware or API routes).
 */
export async function POST(req: NextRequest) {
  // Validate this is an internal call (must have the internal API key)
  const apiKey = req.headers.get('x-internal-key');
  if (apiKey !== process.env.INTERNAL_API_KEY && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { event, severity = 'INFO', metadata = {} } = body;
    
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ua = req.headers.get('user-agent') || 'unknown';
    
    await prisma.userSessionLog.create({
      data: {
        sessionId: crypto.randomUUID(),
        action: event,
        ipAddress: ip,
        userAgent: ua,
        metadata: { severity, ...metadata }
      }
    });
    
    return NextResponse.json({ logged: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
