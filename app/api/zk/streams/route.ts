import { NextRequest, NextResponse } from 'next/server';

interface StreamRecord {
  id: string;
  senderTag: string;
  recipientTag: string;
  senderAddress: string;
  recipientAddress: string;
  token: string;
  depositAmount: string;
  ratePerSecond: string;
  startTime: number;
  stopTime: number;
  withdrawnAmount: string;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  memo: string;
  createdAt: number;
}

const streamsDb = new Map<string, StreamRecord>();

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.toLowerCase();
  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    const stream = streamsDb.get(id);
    if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    return NextResponse.json({ stream });
  }

  if (address) {
    const userStreams: StreamRecord[] = [];
    for (const s of streamsDb.values()) {
      if (s.senderAddress === address || s.recipientAddress === address) {
        userStreams.push(s);
      }
    }
    return NextResponse.json({ streams: userStreams, count: userStreams.length });
  }

  return NextResponse.json({ streams: Array.from(streamsDb.values()) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ error: 'action required (create, withdraw, cancel)' }, { status: 400 });
  }

  if (body.action === 'create') {
    if (!body.senderAddress || !body.recipientAddress || !body.depositAmount || !body.token) {
      return NextResponse.json({ error: 'Missing required stream parameters' }, { status: 400 });
    }

    const duration = body.durationSeconds || 86400;
    const now = Date.now();
    const ratePerSec = (parseFloat(body.depositAmount) / duration).toFixed(8);
    const id = `zstream_${now}_${Math.random().toString(36).substring(2, 6)}`;

    const stream: StreamRecord = {
      id,
      senderTag: body.senderTag || `zk:${body.senderAddress.slice(2, 8)}`,
      recipientTag: body.recipientTag || `zk:${body.recipientAddress.slice(2, 8)}`,
      senderAddress: body.senderAddress.toLowerCase(),
      recipientAddress: body.recipientAddress.toLowerCase(),
      token: body.token,
      depositAmount: body.depositAmount,
      ratePerSecond: ratePerSec,
      startTime: now,
      stopTime: now + duration * 1000,
      withdrawnAmount: '0.00',
      status: 'active',
      memo: body.memo || 'zk.money stream',
      createdAt: now,
    };

    streamsDb.set(id, stream);
    return NextResponse.json({ success: true, stream });
  }

  if (body.action === 'withdraw') {
    const { id, amount } = body;
    const stream = streamsDb.get(id);
    if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 });

    const newWithdrawn = (parseFloat(stream.withdrawnAmount || '0') + parseFloat(amount || '0')).toFixed(4);
    stream.withdrawnAmount = newWithdrawn;
    if (parseFloat(newWithdrawn) >= parseFloat(stream.depositAmount)) {
      stream.status = 'completed';
    }

    streamsDb.set(id, stream);
    return NextResponse.json({ success: true, stream });
  }

  if (body.action === 'cancel') {
    const { id } = body;
    const stream = streamsDb.get(id);
    if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    stream.status = 'cancelled';
    streamsDb.set(id, stream);
    return NextResponse.json({ success: true, stream });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
