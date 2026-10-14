import { NextRequest, NextResponse } from 'next/server';

interface TreasuryRecord {
  communityId: string;
  balances: { DAI: string; USDC: string; ETH: string };
  totalInflow: string;
  totalOutflow: string;
  memberCount: number;
  lastActivity: number;
}

const treasuries = new Map<string, TreasuryRecord>();

export async function GET(req: NextRequest) {
  const communityId = req.nextUrl.searchParams.get('communityId');
  if (!communityId) return NextResponse.json({ error: 'communityId required' }, { status: 400 });

  let record = treasuries.get(communityId);
  if (!record) {
    record = {
      communityId,
      balances: { DAI: '14250.00', USDC: '8500.00', ETH: '3.4500' },
      totalInflow: '28400.00',
      totalOutflow: '5650.00',
      memberCount: 384,
      lastActivity: Date.now(),
    };
    treasuries.set(communityId, record);
  }

  return NextResponse.json({ treasury: record });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.communityId || !body?.action) {
    return NextResponse.json({ error: 'communityId and action required' }, { status: 400 });
  }

  let record = treasuries.get(body.communityId);
  if (!record) {
    record = {
      communityId: body.communityId,
      balances: { DAI: '14250.00', USDC: '8500.00', ETH: '3.4500' },
      totalInflow: '28400.00',
      totalOutflow: '5650.00',
      memberCount: 384,
      lastActivity: Date.now(),
    };
    treasuries.set(body.communityId, record);
  }

  const token = (body.token || 'DAI') as 'DAI' | 'USDC' | 'ETH';
  const amount = parseFloat(body.amount || '0');

  if (body.action === 'deposit') {
    const curr = parseFloat(record.balances[token] || '0');
    record.balances[token] = (curr + amount).toFixed(2);
    record.totalInflow = (parseFloat(record.totalInflow) + amount).toFixed(2);
    record.lastActivity = Date.now();
    treasuries.set(body.communityId, record);
    return NextResponse.json({ success: true, treasury: record });
  }

  if (body.action === 'withdraw') {
    const curr = parseFloat(record.balances[token] || '0');
    if (curr < amount) return NextResponse.json({ error: 'Insufficient treasury balance' }, { status: 400 });

    record.balances[token] = (curr - amount).toFixed(2);
    record.totalOutflow = (parseFloat(record.totalOutflow) + amount).toFixed(2);
    record.lastActivity = Date.now();
    treasuries.set(body.communityId, record);
    return NextResponse.json({ success: true, treasury: record });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
