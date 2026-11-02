import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** GET /api/metrics/users — how many accounts exist. */
export async function GET() {
  try {
    const totalUsers = await prisma.user.count();
    return NextResponse.json({ total: totalUsers }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch {
    // No made-up figure when the database cannot be reached: the page hides the count.
    return NextResponse.json({ total: null }, { status: 503 });
  }
}
