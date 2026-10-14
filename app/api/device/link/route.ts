import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// In-memory store for pending device links (expires in 5 minutes)
// In production, use Redis
const pendingLinks = new Map<string, { bundle: string; expiresAt: number; claimed: boolean }>();

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });
  const pending = pendingLinks.get(token);
  if (!pending) return NextResponse.json({ exists: false, claimed: false, expired: true });
  if (Date.now() > pending.expiresAt) {
    pendingLinks.delete(token);
    return NextResponse.json({ exists: false, claimed: false, expired: true });
  }
  return NextResponse.json({ exists: true, claimed: pending.claimed, expired: false });
}

export async function POST(req: NextRequest) {
  try {
    const { action, token, bundle } = await req.json();

    if (action === 'create') {
      // Device A creates a link token and stores the encrypted bundle
      const linkToken = crypto.randomBytes(16).toString('hex');
      pendingLinks.set(linkToken, {
        bundle: bundle || '',
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        claimed: false
      });
      // Clean expired tokens
      for (const [t, data] of pendingLinks.entries()) {
        if (Date.now() > data.expiresAt) pendingLinks.delete(t);
      }
      return NextResponse.json({ token: linkToken, expiresIn: 300 });
    }

    if (action === 'claim') {
      // Device B claims the bundle using the token from QR
      const pending = pendingLinks.get(token);
      if (!pending || Date.now() > pending.expiresAt) {
        return NextResponse.json({ error: 'Token expired or invalid' }, { status: 404 });
      }
      pending.claimed = true; // Mark claimed so device A knows
      return NextResponse.json({ bundle: pending.bundle, success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('[device/link]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

