import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIP } from '@/lib/security/rateLimiter';

// This route reads from IP address  no authentication needed.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    // The proxy-appended hop, never the client-supplied first one (CLAUDE.md §3).
    let ip = getClientIP(req);

    if (ip === "::1" || ip === "127.0.0.1") {
        ip = "8.8.8.8";
    }

    // Guard: securityEvent model may not exist in deployed Prisma schema
    const prismaAny = prisma as any;
    if (!prismaAny.securityEvent || typeof prismaAny.securityEvent.findMany !== 'function') {
      return NextResponse.json({ sessions: [] }, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    const events: any[] = await prismaAny.securityEvent.findMany({
      where: {
          ipAddress: ip,
          type: "SYSTEM_ACCESS"
      },
      orderBy: { timestamp: 'desc' },
      take: 50
    }) ?? [];

    const mappedSessions = (Array.isArray(events) ? events : []).map((ev: any, index: number) => {
      const meta = ev?.metadata || {};
      return {
        id: ev.id,
        sessionToken: ev.id,
        device: meta.deviceType === "mobile" ? "Mobile Device" : "Desktop System",
        browser: meta.browser || "Unknown Browser",
        location: meta.location || "Unknown Location",
        ip: ev.ipAddress,
        lastActive: ev.timestamp,
        current: index === 0
      };
    });

    return NextResponse.json({ sessions: mappedSessions }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    // Silently return empty  this is a non-critical endpoint
    return NextResponse.json({ sessions: [] }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}
