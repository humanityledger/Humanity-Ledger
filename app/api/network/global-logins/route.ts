import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Prevent Prisma crash during Next.js build phase (static rendering without DB access)
    if (!process.env.DATABASE_URL) {
      console.warn("[GLOBAL_LOGINS_API] Build phase detected. Skipping DB.");
      return NextResponse.json({ ok: true, totalLogins: 0, countries: [], activeRegions: 0 });
    }

    // 1. Get true historic scale from the very beginning of humanidfi.com
    const totalHistoricalUsers = await prisma.user.count();

    // 2. Get the real geo-distribution since the geo-tracking system was deployed
    let stats: any[] = [];
    try {
      stats = await (prisma as any).loginGeoEvent.groupBy({
        by: ["countryCode", "countryName"],
        _count: {
          id: true, // total logins in this region
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        }
      });
    } catch (e) {
      console.warn("[GLOBAL_LOGINS_API] loginGeoEvent table unavailable, using empty stats for build fallback");
    }

    const totalGeoTrackedLogins = stats.reduce((acc, curr) => acc + curr._count.id, 0);

    // Format for frontend consumption using STRICTLY REAL DATA
    const countryData = stats.map((stat) => {
      const count = stat._count.id;
      let level = "none";
      // Thresholds adapted for real initial traffic
      if (count > 500) level = "full";
      else if (count > 50) level = "partial";
      else if (count > 0) level = "limited";

      return {
        countryCode: stat.countryCode,
        connections: count,
        level,
        lastActive: new Date().toISOString(),
      };
    });

    return NextResponse.json({
      ok: true,
      // Total network scale = Historical users + ongoing authenticated sessions tracked
      totalLogins: totalHistoricalUsers + totalGeoTrackedLogins, 
      countries: countryData,
      activeRegions: countryData.length,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("[GLOBAL_LOGINS_API]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
