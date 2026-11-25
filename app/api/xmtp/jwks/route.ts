/**
 * GET /api/xmtp/jwks: the public key our XMTP backend uses to check credentials ([auth] jwks_url).
 * Public by design: it holds only the public half of the signing key. 404 until configured.
 */
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { backendTokenKeys, publicJwks } from '@/lib/xmtp/backend-token';

export const dynamic = 'force-dynamic';

export async function GET() {
  const keys = backendTokenKeys();
  if (!keys) return NextResponse.json({ keys: [] }, { status: 404 });
  const body = publicJwks(keys);
  const etag = `W/"${createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16)}"`;
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      ETag: etag,
    },
  });
}
