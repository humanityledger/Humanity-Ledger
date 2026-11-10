/**
 * POST /api/chat/attachments — store one encrypted chat attachment.
 *
 * The body is CIPHERTEXT (application/octet-stream), produced in the sender's
 * browser by lib/chat/remote-attachment.ts. This route never receives
 * plaintext media, never sees the key, and stores nothing that identifies the
 * uploader or the conversation next to the object.
 *
 * It used to accept the plaintext file, check its magic bytes and return it
 * as a base64 data URL that was then embedded in the XMTP message. That gave
 * the server every voice note in clear and did not reduce the message size.
 * The magic-byte check now runs on the recipient's device after decryption
 * (lib/chat/file-sniff.ts).
 *
 * Responses:
 *   200 { url, contentDigest, size }   url = /api/chat/attachments/<id>
 *   401 not signed in · 413 too large · 415 not octet-stream
 *   422 { error: 'plaintext_suspected' } the body starts like a plain file
 *   429 rate limited · 503 { error: 'storage_unavailable' } R2 not configured
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';

import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { r2ConfigFromEnv, r2Put } from '@/lib/storage/r2';
import { GCM_TAG_BYTES, MAX_ATTACHMENT_BYTES } from '@/lib/chat/remote-attachment';
import { looksLikePlaintextFile } from '@/lib/chat/file-sniff';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_CIPHERTEXT = MAX_ATTACHMENT_BYTES + GCM_TAG_BYTES;

export async function POST(req: Request) {
  // [SECURITY] Require an authenticated session — never accept files from anonymous clients
  const caller = await getVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = await checkRateLimit(caller, { max: 30, windowSec: 60, prefix: 'chat-att-put' });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many uploads. Wait a moment.' }, { status: 429 });

  const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/octet-stream') {
    return NextResponse.json({ error: 'Send the encrypted attachment as application/octet-stream' }, { status: 415 });
  }
  const declared = Number(req.headers.get('content-length') || '0');
  if (declared > MAX_CIPHERTEXT) return NextResponse.json({ error: 'Files can be up to 20 MB' }, { status: 413 });

  const cfg = r2ConfigFromEnv();
  if (!cfg) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  try {
    const body = new Uint8Array(await req.arrayBuffer());
    if (body.byteLength <= GCM_TAG_BYTES) return NextResponse.json({ error: 'Empty attachment' }, { status: 400 });
    if (body.byteLength > MAX_CIPHERTEXT) return NextResponse.json({ error: 'Files can be up to 20 MB' }, { status: 413 });
    // [SECURITY] Refuse what is obviously an unencrypted file, so a buggy or
    // outdated client cannot silently put plaintext media in the bucket.
    if (looksLikePlaintextFile(body)) {
      return NextResponse.json({ error: 'plaintext_suspected' }, { status: 422 });
    }

    const id = crypto.randomBytes(16).toString('hex');
    await r2Put(cfg, `chat-attachments/${id}`, body);
    const contentDigest = crypto.createHash('sha256').update(body).digest('hex');

    return NextResponse.json({ url: `/api/chat/attachments/${id}`, contentDigest, size: body.byteLength });
  } catch (error) {
    console.error('[chat/attachments POST] store failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  }
}
