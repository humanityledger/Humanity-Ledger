import { NextResponse } from 'next/server';
import { appendAuditEntry } from '@/lib/audit/audit-trail';
import { createHash, timingSafeEqual } from 'crypto';

// This route must NOT be edge runtime. It runs on Node.js to support Prisma and crypto.
export const runtime = 'nodejs';

function digest(s: string): Buffer {
  return createHash('sha256').update(s).digest();
}

export async function POST(req: Request) {
  // [SECURITY HARDENING] The AUDIT_SECRET must be a real cryptographic secret set via env.
  // Previously defaulted to 'true', meaning any attacker who sent x-internal-audit: true
  // had full write access to forge audit log entries and corrupt the tamper-evident trail.
  const expectedSecret = process.env.AUDIT_SECRET;
  if (!expectedSecret || expectedSecret === 'true' || expectedSecret.length < 32) {
    console.error('[AUDIT_ROUTE] CRITICAL: AUDIT_SECRET is not set or is too weak. Route is disabled.');
    return NextResponse.json({ error: 'Service Unavailable: Audit route not configured.' }, { status: 503 });
  }
  const isInternal = req.headers.get('x-internal-audit') || '';
  if (!timingSafeEqual(digest(isInternal), digest(expectedSecret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let payload;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const { action, actor, ip, metadata } = payload;
    if (action && actor && ip) {
      await appendAuditEntry(action as any, actor, ip, metadata);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Internal Audit API] Failed to log:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
