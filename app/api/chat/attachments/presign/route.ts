/**
 * POST /api/chat/attachments/presign — issue short-lived S3v4 presigned PUT URL(s)
 * for direct browser -> Cloudflare R2 ciphertext uploads (16 MiB pieces up to 32 GiB).
 *
 * Keeps Railway Node.js memory and egress out of the media path while preserving
 * SIWE session authentication, Redis rate limiting, and hourly per-wallet byte quotas.
 *
 * When Cloudflare R2 is not configured, returns { mode: 'proxy', fallbackUrl: '/api/chat/attachments' }.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';

import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { GCM_TAG_BYTES, MAX_ATTACHMENT_BYTES } from '@/lib/chat/remote-attachment';
import { checkAttachmentQuota, isR2Enabled, presignObjectPut, type StorageScope } from '@/lib/storage/chat-attachment-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_CIPHERTEXT = MAX_ATTACHMENT_BYTES + GCM_TAG_BYTES;
const MAX_AVATAR_BYTES = 500_000;
const MAX_BATCH = 64;
const ALLOWED_SCOPES = new Set<StorageScope>(['attachment', 'status', 'avatar']);
const AVATAR_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function pathForScope(scope: StorageScope, id: string): string {
  if (scope === 'status') return `/api/chat/stories/media/${id}`;
  if (scope === 'avatar') return `/api/chat/avatars/${id}`;
  return `/api/chat/attachments/${id}`;
}

export async function POST(req: Request) {
  const caller = await getVerifiedCaller(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await checkRateLimit(caller, { max: 300, windowSec: 60, prefix: 'chat-att-presign' });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '10' } });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const scope: StorageScope = ALLOWED_SCOPES.has(body?.scope) ? body.scope : 'attachment';
  const rawSizes: unknown[] = Array.isArray(body?.sizes) ? body.sizes : body?.size !== undefined ? [body.size] : [];

  if (rawSizes.length === 0 || rawSizes.length > MAX_BATCH) {
    return NextResponse.json({ error: `Provide between 1 and ${MAX_BATCH} piece sizes` }, { status: 400 });
  }

  const maxPerItem = scope === 'avatar' ? MAX_AVATAR_BYTES : MAX_CIPHERTEXT;
  const minPerItem = scope === 'avatar' ? 1 : GCM_TAG_BYTES + 1;
  const sizes: number[] = [];
  let totalBytes = 0;

  for (const raw of rawSizes) {
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < minPerItem || n > maxPerItem) {
      return NextResponse.json({ error: 'Attachment size out of bounds' }, { status: 413 });
    }
    sizes.push(n);
    totalBytes += n;
  }

  let contentType = 'application/octet-stream';
  if (scope === 'avatar') {
    const requestedType = typeof body?.contentType === 'string' ? body.contentType.split(';')[0].trim().toLowerCase() : 'image/png';
    if (!AVATAR_CONTENT_TYPES.has(requestedType)) {
      return NextResponse.json({ error: 'Unsupported avatar MIME type' }, { status: 415 });
    }
    contentType = requestedType;
  }

  if (!isR2Enabled()) {
    return NextResponse.json({
      mode: 'proxy',
      fallbackUrl: scope === 'status' ? '/api/chat/stories/media' : '/api/chat/attachments',
    });
  }

  const quota = await checkAttachmentQuota(caller, totalBytes);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'Hourly upload quota exceeded', quotaLimitBytes: quota.limitBytes },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const expiresIn = 900;
  const items = sizes.map(() => {
    const id = crypto.randomBytes(16).toString('hex');
    const uploadUrl = presignObjectPut(scope, id, { expiresSec: expiresIn, contentType });
    if (!uploadUrl) throw new Error('presign_failed');
    return {
      id,
      uploadUrl,
      url: pathForScope(scope, id),
      expiresIn,
      headers: { 'Content-Type': contentType },
    };
  });

  if (!Array.isArray(body?.sizes)) {
    const first = items[0];
    return NextResponse.json({ mode: 'direct', ...first, items });
  }
  return NextResponse.json({ mode: 'direct', items, expiresIn });
}
