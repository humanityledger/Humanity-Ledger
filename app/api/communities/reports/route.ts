import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await req.json();
  const { communityId, messageId, reason } = body;
  if (!communityId || !reason) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  
  return NextResponse.json({ success: true, reportId: 'rep_' + Date.now() });
}
