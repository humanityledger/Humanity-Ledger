import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function resolveCaller(req: NextRequest) {
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  return null; // Spoofing vector closed
}

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userSettings = await (prisma as any).userSettings.findUnique({
      where: { walletAddress: caller }
    });

    return NextResponse.json({ settings: userSettings?.settings || {} });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { settings } = await req.json();

    const updated = await (prisma as any).userSettings.upsert({
      where: { walletAddress: caller },
      update: { settings, lastSyncedAt: new Date() },
      create: { walletAddress: caller, settings, lastSyncedAt: new Date() }
    });

    return NextResponse.json({ settings: updated.settings });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
