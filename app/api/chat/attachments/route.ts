/**
 * POST /api/chat/attachments — store one encrypted chat attachment.
 *
 * The body is CIPHERTEXT (application/octet-stream), produced in the sender's
 * browser by lib/chat/remote-attachment.ts or lib/chat/large-file.ts. This route
 * never receives plaintext media, never sees the key, and stores nothing that
 * identifies the uploader or the conversation next to the object.
 *
 * It uses Cloudflare R2 when configured, with seamless persistent local storage
 * fallback so uploads (including chunked uploads up to 32 GB) never fail.
 *
 * Responses:
 *   200 { url, contentDigest, size }   url = /api/chat/attachments/<id>
 *   401 not signed in · 413 too large · 415 not octet-stream
 *   422 { error: 'plaintext_suspected' } the body starts like a plain file
 *   429 rate limited · 503 { error: 'storage_unavailable' } when storage fails completely
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';

import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { putChatAttachment } from '@/lib/storage/chat-attachment-store';
import { GCM_TAG_BYTES, MAX_ATTACHMENT_BYTES } from '@/lib/chat/remote-attachment';
import { looksLikePlaintextFile } from '@/lib/chat/file-sniff';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_CIPHERTEXT = MAX_ATTACHMENT_BYTES + GCM_TAG_BYTES;

export async function POST(req: Request) {
  // [SECURITY] Require an authenticated session — never accept files from anonymous clients
  const caller = await getVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit allows high-speed chunked uploading of large files up to 32 GB (up to 3000 pieces/min)
  const limit = await checkRateLimit(caller, { max: 3000, windowSec: 60, prefix: 'chat-att-put' });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many uploads. Wait a moment.' }, { status: 429 });

  const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/octet-stream') {
    return NextResponse.json({ error: 'Send the encrypted attachment as application/octet-stream' }, { status: 415 });
  }
  const declared = Number(req.headers.get('content-length') || '0');
  if (declared > MAX_CIPHERTEXT) return NextResponse.json({ error: 'Files can be up to 20 MB per chunk' }, { status: 413 });

  try {
    const body = new Uint8Array(await req.arrayBuffer());
    if (body.byteLength <= GCM_TAG_BYTES) return NextResponse.json({ error: 'Empty attachment' }, { status: 400 });
    if (body.byteLength > MAX_CIPHERTEXT) return NextResponse.json({ error: 'Files can be up to 20 MB per chunk' }, { status: 413 });

    // [SECURITY] Refuse what is obviously an unencrypted file, so a buggy or
    // outdated client cannot silently put plaintext media in storage.
    if (looksLikePlaintextFile(body)) {
      return NextResponse.json({ error: 'plaintext_suspected' }, { status: 422 });
    }

    const id = crypto.randomBytes(16).toString('hex');
    await putChatAttachment(id, body);
    const contentDigest = crypto.createHash('sha256').update(body).digest('hex');

    return NextResponse.json({ url: `/api/chat/attachments/${id}`, contentDigest, size: body.byteLength });
  } catch (error) {
    console.error('[chat/attachments POST] store failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
}
