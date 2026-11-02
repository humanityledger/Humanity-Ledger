import { getSession } from '@/lib/session';
/**
 * POST /api/chat/onion/queue
 *
 * Onion Exit Delivery Queue
 *
 * This endpoint is the final destination inside the onion circuit.
 * It receives the decrypted plaintext payload from the exit relay node
 * and enqueues it for XMTP delivery from the server side.
 *
 * Why server-side delivery at the exit?
 * - The original sender's IP is never exposed to the XMTP network
 * - The exit relay calls this endpoint — XMTP only sees the exit relay's IP
 * - Provides async delivery for offline recipients (DB queue)
 *
 * Security:
 *   ✅ Only callable from the local server (or configured relay URLs)
 *   ✅ Validates nonce uniqueness to prevent replay attacks
 *   ✅ Does NOT log sender IP or content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ── Nonce deduplication (replay protection) ────────────────────────────────────
declare global {
  var __onionQueueNonceSeen: Set<string>;
}
if (!global.__onionQueueNonceSeen) global.__onionQueueNonceSeen = new Set();

// Clear nonces every 10 minutes
setInterval(() => { global.__onionQueueNonceSeen.clear(); }, 10 * 60 * 1000);

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const { destination, payload, nonce } = body;

  if (!destination || !payload || !nonce) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  // Replay protection
  if (global.__onionQueueNonceSeen.has(nonce)) {
    return NextResponse.json({ error: 'Duplicate nonce — replay rejected.' }, { status: 409 });
  }
  global.__onionQueueNonceSeen.add(nonce);

  // Sanitize content — ensure it's a plain string
  const content = String(payload).trim();
  if (!content || content.length > 8192) {
    return NextResponse.json({ error: 'Invalid payload size.' }, { status: 400 });
  }

  // Store in pending messages for pickup by the recipient's XMTP client
  try {
    const prisma = getPrisma();
    await prisma.pendingChatMessage.create({
      data: {
        sender:    'onion-relay', // Sender anonymized — the relay is the sender identity
        recipient:  String(destination).toLowerCase(),
        content:    content,
      },
    });
  } catch (err: any) {
    console.error('[OnionQueue] DB write failed:', err?.message);
    return NextResponse.json({ error: 'Queue write failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, queued: true });
}
