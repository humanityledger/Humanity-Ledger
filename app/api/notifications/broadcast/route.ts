import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

// T-11: Enforce getSession() — ignore ?userId= query parameter.
// /api/notifications/ removed from public middleware bypass.

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // Broadcast is admin-only: require userId to be the designated admin address
    const adminAddress = (process.env.ADMIN_WALLET_ADDRESS || '').toLowerCase();
    if (adminAddress && session.userId.toLowerCase() !== adminAddress) {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const { title, message, type, actionUrl } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and Message required' }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: type || 'system',
        isGlobal: true,
        actionUrl,
      },
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error('Broadcast Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // T-11: Derive userId from session only — ignore ?userId= query param entirely
    const userId = session.userId;

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { isGlobal: true },
          { userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Notification Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
