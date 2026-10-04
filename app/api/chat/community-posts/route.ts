import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: '410 Gone: Protocol upgraded to True P2P (XMTP). Centralized storage is decommissioned.' }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: '410 Gone: Protocol upgraded to True P2P (XMTP). Centralized storage is decommissioned.' }, { status: 410 });
}
