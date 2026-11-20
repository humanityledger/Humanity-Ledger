/**
 * POST /api/chat/stories/media — store the ciphertext of a photo or video Status in Postgres.
 *
 * Used only when the R2 bucket for chat attachments is not configured (that route answers 503).
 * Same rules as /api/chat/attachments: signed-in wallets only, octet-stream only, 20 MB, and
 * anything that looks like a plain file is refused. The row expires after 24 hours, with the
 * status. The key never comes here, but it is in the Story record on the same server.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';

import { prisma } from '@/lib/prisma';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { GCM_TAG_BYTES, MAX_ATTACHMENT_BYTES } from '@/lib/chat/remote-attachment';
import { looksLikePlaintextFile } from '@/lib/chat/file-sniff';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_CIPHERTEXT = MAX_ATTACHMENT_BYTES + GCM_TAG_BYTES;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE = 30;

export async function POST(req: Request) {
  const caller = await getVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = caller.toLowerCase();

  const limit = await checkRateLimit(me, { max: 10, windowSec: 60, prefix: 'status-media-put' });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many uploads. Wait a moment.' }, { status: 429 });

  const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/octet-stream') return NextResponse.json({ error: 'Send the encrypted file as application/octet-stream' }, { status: 415 });
  if (Number(req.headers.get('content-length') || '0') > MAX_CIPHERTEXT) return NextResponse.json({ error: 'Files can be up to 20 MB' }, { status: 413 });

  try {
    const now = new Date();
    // Expired media goes first, so the table only ever holds the last 24 hours.
    await prisma.statusMedia.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => {});
    const active = await prisma.statusMedia.count({ where: { authorAddress: me, expiresAt: { gt: now } } });
    if (active >= MAX_ACTIVE) return NextResponse.json({ error: 'Too many active statuses' }, { status: 429 });

    const body = new Uint8Array(await req.arrayBuffer());
    if (body.byteLength <= GCM_TAG_BYTES) return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    if (body.byteLength > MAX_CIPHERTEXT) return NextResponse.json({ error: 'Files can be up to 20 MB' }, { status: 413 });
    if (looksLikePlaintextFile(body)) return NextResponse.json({ error: 'plaintext_suspected' }, { status: 422 });

    const id = crypto.randomBytes(16).toString('hex');
    await prisma.statusMedia.create({
      data: { id, authorAddress: me, bytes: Buffer.from(body), size: body.byteLength, expiresAt: new Date(now.getTime() + TTL_MS) },
    });
    const contentDigest = crypto.createHash('sha256').update(body).digest('hex');
    return NextResponse.json({ url: `/api/chat/stories/media/${id}`, contentDigest, size: body.byteLength });
  } catch (error) {
    console.error('[stories/media POST] store failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
}
