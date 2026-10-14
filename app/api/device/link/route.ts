import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// In-memory store for pending device links (expires in 5 minutes, max 1000 entries)
const MAX_PENDING_LINKS = 1000;
const MAX_BUNDLE_SIZE = 512 * 1024; // 512 KB
const TOKEN_REGEX = /^[0-9a-fA-F]{32}$/;

const pendingLinks = new Map<string, { bundle: string; expiresAt: number; claimed: boolean }>();

function cleanupExpiredLinks() {
  const now = Date.now();
  for (const [t, data] of pendingLinks.entries()) {
    if (now > data.expiresAt) pendingLinks.delete(t);
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token || !TOKEN_REGEX.test(token)) {
    return NextResponse.json({ error: 'Valid token required' }, { status: 400 });
  }
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
    const body = await req.json().catch(() => ({}));
    const { action, token, bundle } = body;

    cleanupExpiredLinks();

    if (action === 'create') {
      if (pendingLinks.size >= MAX_PENDING_LINKS) {
        return NextResponse.json({ error: 'Server link capacity reached. Try again later.' }, { status: 429 });
      }

      if (bundle && (typeof bundle !== 'string' || bundle.length > MAX_BUNDLE_SIZE)) {
        return NextResponse.json({ error: 'Bundle payload exceeds maximum allowed size' }, { status: 413 });
      }

      // Device A creates a link token and stores the encrypted bundle
      const linkToken = crypto.randomBytes(16).toString('hex');
      pendingLinks.set(linkToken, {
        bundle: bundle || '',
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        claimed: false
      });

      return NextResponse.json({ token: linkToken, expiresIn: 300 });
    }

    if (action === 'claim') {
      if (!token || !TOKEN_REGEX.test(token)) {
        return NextResponse.json({ error: 'Valid token required' }, { status: 400 });
      }

      // Device B claims the bundle using the token from QR
      const pending = pendingLinks.get(token);
      if (!pending || Date.now() > pending.expiresAt) {
        return NextResponse.json({ error: 'Token expired or invalid' }, { status: 404 });
      }

      if (pending.claimed) {
        return NextResponse.json({ error: 'Token has already been claimed' }, { status: 410 });
      }

      // Single-use guarantee: mark claimed and purge payload immediately from memory
      pending.claimed = true;
      const claimedBundle = pending.bundle;
      pending.bundle = ''; // Zero-out sensitive data immediately after claim

      // Schedule token removal in 15 seconds to allow Device A status poll to acknowledge
      setTimeout(() => pendingLinks.delete(token), 15000);

      return NextResponse.json({ bundle: claimedBundle, success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('[device/link]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

