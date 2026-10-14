import { NextRequest, NextResponse } from 'next/server';

interface EscrowRecord {
  id: string;
  senderTag: string;
  recipientTag: string;
  senderAddress: string;
  recipientAddress: string;
  token: string;
  amount: string;
  status: 'locked' | 'released' | 'disputed' | 'cancelled';
  conditions: string;
  milestones: Array<{ id: string; description: string; amount: string; status: string }>;
  createdAt: number;
}

const escrowDb = new Map<string, EscrowRecord>();

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.toLowerCase();
  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    const record = escrowDb.get(id);
    if (!record) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });
    return NextResponse.json({ escrow: record });
  }

  if (address) {
    const matching: EscrowRecord[] = [];
    for (const esc of escrowDb.values()) {
      if (esc.senderAddress === address || esc.recipientAddress === address) {
        matching.push(esc);
      }
    }
    return NextResponse.json({ escrows: matching, count: matching.length });
  }

  return NextResponse.json({ escrows: Array.from(escrowDb.values()) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ error: 'action required (create, release_milestone, dispute, cancel)' }, { status: 400 });
  }

  if (body.action === 'create') {
    if (!body.senderAddress || !body.recipientAddress || !body.amount || !body.token) {
      return NextResponse.json({ error: 'Missing required escrow parameters' }, { status: 400 });
    }

    const id = `escrow_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newEscrow: EscrowRecord = {
      id,
      senderTag: body.senderTag || `zk:${body.senderAddress.slice(2, 8)}`,
      recipientTag: body.recipientTag || `zk:${body.recipientAddress.slice(2, 8)}`,
      senderAddress: body.senderAddress.toLowerCase(),
      recipientAddress: body.recipientAddress.toLowerCase(),
      token: body.token,
      amount: body.amount,
      status: 'locked',
      conditions: body.conditions || 'Milestone delivery',
      milestones: body.milestones || [{ id: 'm1', description: 'Full Delivery', amount: body.amount, status: 'pending' }],
      createdAt: Date.now(),
    };

    escrowDb.set(id, newEscrow);
    return NextResponse.json({ success: true, escrow: newEscrow });
  }

  if (body.action === 'release_milestone') {
    const { id, milestoneId } = body;
    const esc = escrowDb.get(id);
    if (!esc) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });

    const mIdx = esc.milestones.findIndex(m => m.id === milestoneId);
    if (mIdx !== -1) {
      esc.milestones[mIdx].status = 'approved';
    }

    const allApproved = esc.milestones.every(m => m.status === 'approved');
    if (allApproved) esc.status = 'released';

    escrowDb.set(id, esc);
    return NextResponse.json({ success: true, escrow: esc });
  }

  if (body.action === 'dispute') {
    const { id } = body;
    const esc = escrowDb.get(id);
    if (!esc) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });
    esc.status = 'disputed';
    escrowDb.set(id, esc);
    return NextResponse.json({ success: true, escrow: esc });
  }

  if (body.action === 'cancel') {
    const { id } = body;
    const esc = escrowDb.get(id);
    if (!esc) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });
    esc.status = 'cancelled';
    escrowDb.set(id, esc);
    return NextResponse.json({ success: true, escrow: esc });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
