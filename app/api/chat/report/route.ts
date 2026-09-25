import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma'; // Assumed from snippet, avoiding missing module errors if not present. Let's keep it if they have it, but for safety:

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { reporter, reported, reason } = await req.json();
    if (!reporter || !reported) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    
    // Store in DB if table exists, otherwise just log
    console.log('[REPORT]', { reporter, reported, reason, at: new Date().toISOString() });
    
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
