/**
 * GET /api/chat/attachments/[id] — fetch one encrypted chat attachment.
 *
 * Returns ciphertext only; the key travels in the XMTP message, never here.
 * Any signed-in wallet may fetch an id: ids are 128 random bits, the content
 * is useless without the key, and the server does not record who is in which
 * conversation (so it could not check membership without learning it).
 *
 * Served as an opaque download (octet-stream, nosniff, attachment) so that a
 * browser opening the URL directly never interprets the bytes.
 */
import { NextResponse } from 'next/server';

import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { getChatAttachment } from '@/lib/storage/chat-attachment-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const ID_RE = /^[0-9a-f]{32}$/;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await getVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!ID_RE.test(id || '')) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Rate limit allows high-speed chunked downloading of large files up to 32 GB (up to 3000 chunks/min)
  const limit = await checkRateLimit(caller, { max: 3000, windowSec: 60, prefix: 'chat-att-get' });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body = await getChatAttachment(id);
    if (!body) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return new NextResponse(body as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(body.byteLength),
        'Content-Disposition': 'attachment',
        'X-Content-Type-Options': 'nosniff',
        // Immutable: an id is never reused. Private: only the signed-in browser caches it.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[chat/attachments GET] fetch failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
}
