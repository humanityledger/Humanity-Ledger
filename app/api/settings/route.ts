import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const web3Address = (req as any).headers?.get?.('x-verified-session-address');
    const userId = session?.userId || web3Address;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    const settings = await prisma.userSettings.upsert({
      where: { walletAddress: userId.toLowerCase() },
      update: { settings: body, lastSyncedAt: new Date() },
      create: {
        walletAddress: userId.toLowerCase(),
        settings: body,
        lastSyncedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, settings: settings.settings });
  } catch (error: any) {
    console.error('[Settings API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    const web3Address = (req as any).headers?.get?.('x-verified-session-address');
    const userId = session?.userId || web3Address;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settingsRow = await prisma.userSettings.findUnique({
      where: { walletAddress: userId.toLowerCase() }
    });

    if (!settingsRow || !settingsRow.settings) {
      return NextResponse.json({ settings: null });
    }

    return NextResponse.json({ settings: settingsRow.settings });
  } catch (error: any) {
    console.error('[Settings API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

