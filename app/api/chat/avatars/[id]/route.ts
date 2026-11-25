/**
 * GET /api/chat/avatars/[id] — serve an uploaded profile avatar.
 * Redirects straight to Cloudflare R2 presigned GET when configured; falls back to local object store.
 */
import { NextResponse } from 'next/server';
import { getAvatarObject, isR2Enabled, presignObjectGet } from '@/lib/storage/chat-attachment-store';

export const dynamic = 'force-dynamic';

const ID_RE = /^[0-9a-f]{32}$/;

function sniffImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  return 'application/octet-stream';
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID_RE.test(id || '')) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (isR2Enabled()) {
    const signed = presignObjectGet('avatar', id, 3600);
    if (signed) {
      return NextResponse.redirect(signed, {
        status: 307,
        headers: {
          'Cache-Control': 'public, max-age=1800',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
  }

  const body = await getAvatarObject(id);
  if (!body) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const mime = sniffImageMime(body);
  return new NextResponse(body as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(body.byteLength),
      ...(mime === 'application/octet-stream' ? { 'Content-Disposition': 'attachment' } : {}),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
