/**
 * GET /api/chat/stories/media/[id] — the ciphertext of one photo or video Status.
 *
 * Signed-in wallets only. Ids are 128 random bits and the bytes are useless without the key in
 * the Story record, which only the author's contacts (and the picked audience) receive. Served as
 * an opaque download so a browser opening the URL never interprets the bytes.
 */
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

const ID_RE = /^[0-9a-f]{32}$/;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await getVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!ID_RE.test(id || '')) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const limit = await checkRateLimit(caller, { max: 240, windowSec: 60, prefix: 'status-media-get' });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const row = await prisma.statusMedia.findUnique({ where: { id }, select: { bytes: true, expiresAt: true } });
    if (!row || row.expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = new Uint8Array(row.bytes);
    return new NextResponse(body as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(body.byteLength),
        'Content-Disposition': 'attachment',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=86400, immutable',
      },
    });
  } catch (error) {
    console.error('[stories/media GET] fetch failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
}
