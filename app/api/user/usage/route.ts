import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * GET /api/user/usage
 * Returns real-time usage statistics for the authenticated user:
 * - Total DPP (Digital Product Passports) created
 * - DPP created today
 * - DPP created this month
 * - Last 7 days daily breakdown for the chart
 * - Total passport categories breakdown
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  
  // Session only. A ?wallet= fallback answered for any wallet whenever the
  // session was not readable here (e.g. a token revoked by logout, which the
  // edge cannot see), so it exposed other people's figures.
  const issuerAddress = session?.userId?.toLowerCase();

  if (!issuerAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel for maximum speed
  const [
    totalPassports,
    todayPassports,
    monthPassports,
    last7DaysPassports,
    categoryBreakdown,
    recentPassports,
  ] = await Promise.all([
    // Total all-time
    prisma.productPassport.count({
      where: { issuerAddress },
    }),

    // Today's count
    prisma.productPassport.count({
      where: {
        issuerAddress,
        createdAt: { gte: startOfToday },
      },
    }),

    // This month
    prisma.productPassport.count({
      where: {
        issuerAddress,
        createdAt: { gte: startOfMonth },
      },
    }),

    // Last 7 days — individual records so we can group by day
    prisma.productPassport.findMany({
      where: {
        issuerAddress,
        createdAt: { gte: sevenDaysAgo },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),

    // Category breakdown
    prisma.productPassport.groupBy({
      by: ['category'],
      where: { issuerAddress },
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
    }),

    // 5 most recent passports
    prisma.productPassport.findMany({
      where: { issuerAddress },
      select: {
        id: true,
        title: true,
        category: true,
        publicSlug: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  // Build last-7-days chart: [ { date: 'Mon', count: 3 }, ... ]
  const dailyMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    dailyMap[key] = 0;
  }
  for (const p of last7DaysPassports) {
    const key = p.createdAt.toISOString().slice(0, 10);
    if (key in dailyMap) dailyMap[key]++;
  }
  const dailyChart = Object.entries(dailyMap).map(([date, count]) => ({
    date,
    label: new Date(date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
    count,
  }));

  return NextResponse.json({
    issuerAddress,
    totalPassports,
    todayPassports,
    monthPassports,
    dailyChart,
    categoryBreakdown: categoryBreakdown.map(c => ({
      category: c.category,
      count: c._count._all,
    })),
    recentPassports,
    generatedAt: now.toISOString(),
  });
}
