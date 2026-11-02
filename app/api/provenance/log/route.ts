import { NextRequest, NextResponse } from 'next/server';
import { validateSecureRequest } from '@/lib/security/premium-security';
import { logProvenanceEvent, ProvenanceEventType } from '@/lib/aztec/provenanceIndexer';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES: ProvenanceEventType[] = ['LEDGER_CHAT_SYNC', 'PORTFOLIO_ACCESS', 'STUDIO_ACCESS'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, details } = body;

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    // Try to get authenticated address from session
    const validation = await validateSecureRequest(req);
    const address = validation.userId;

    // SECURITY FIX VULN-04: The previous code fell back to trusting details.address from
    // the request body if no session was present. This allowed any unauthenticated attacker
    // to log provenance events under any wallet address (Log Injection / Identity Spoofing).
    // Now: no valid JWT → silently skip. Fire-and-forget never exposes errors anyway.
    if (!address) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // Only a short page path is kept. Free-form client JSON was stored as is
    // (no size limit) and its targetAddress set the record's recipient.
    const path = typeof details?.path === 'string' && /^\/[\w\-/]{0,100}$/.test(details.path) ? details.path : undefined;
    const record = await logProvenanceEvent(type as ProvenanceEventType, address, path ? { path } : {});
    
    return NextResponse.json({ success: true, hash: record?.txHash });
  } catch (err: any) {
    console.error('[Provenance Log] Error:', err);
    // Always return 200 — this is fire-and-forget from the frontend
    return NextResponse.json({ success: false });
  }
}
