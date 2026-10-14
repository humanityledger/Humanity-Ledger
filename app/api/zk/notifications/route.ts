import { NextRequest, NextResponse } from 'next/server';

// In-memory notification store (use Redis in production)
interface ZkNotificationRecord {
  id: string;
  address: string;
  type: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  link?: string;
  metadata?: Record<string, any>;
}

const notificationsDb = new Map<string, ZkNotificationRecord[]>();

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.toLowerCase();
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const notifications = notificationsDb.get(address) || [];
  const unread = notifications.filter(n => !n.read).length;

  return NextResponse.json({
    notifications: notifications.slice(0, 50),
    unread,
    total: notifications.length,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.action || !body?.address) {
    return NextResponse.json({ error: 'action and address required' }, { status: 400 });
  }

  const address = body.address.toLowerCase();

  if (body.action === 'push') {
    if (!body.type || !body.title || !body.body) {
      return NextResponse.json({ error: 'type, title, body required for push' }, { status: 400 });
    }

    const notif: ZkNotificationRecord = {
      id: `zkn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      address,
      type: body.type,
      title: body.title,
      body: body.body,
      timestamp: Date.now(),
      read: false,
      link: body.link,
      metadata: body.metadata,
    };

    const existing = notificationsDb.get(address) || [];
    existing.unshift(notif);
    notificationsDb.set(address, existing.slice(0, 100)); // max 100

    return NextResponse.json({ success: true, notification: notif });
  }

  if (body.action === 'mark_read') {
    const existing = notificationsDb.get(address) || [];
    const updated = existing.map(n => ({ ...n, read: true }));
    notificationsDb.set(address, updated);
    return NextResponse.json({ success: true, updated: updated.length });
  }

  if (body.action === 'clear_all') {
    notificationsDb.set(address, []);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
