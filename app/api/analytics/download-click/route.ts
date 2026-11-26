import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getClientIP } from '@/lib/security/rateLimiter';

const clickSchema = z.object({
  platform: z.string(),
  timestamp: z.string()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, timestamp } = clickSchema.parse(body);

    // Get geolocation from headers
    const country = request.headers.get('cf-ipcountry') || 'Unknown';
    const ip = getClientIP(request);

    // Log analytics event (TODO: Add analyticsEvent table to Prisma schema)
    console.log('[Analytics] Download click:', {
      platform,
      country,
      userAgent: request.headers.get('user-agent') || '',
      timestamp: new Date(timestamp)
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}

