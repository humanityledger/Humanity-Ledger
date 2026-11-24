/**
 * GET /api/xmtp/jwks: the public key our XMTP backend uses to check credentials ([auth] jwks_url).
 * Public by design: it holds only the public half of the signing key. 404 until configured.
 */
import { NextResponse } from 'next/server';
import { backendTokenKeys, publicJwks } from '@/lib/xmtp/backend-token';

export const dynamic = 'force-dynamic';

export async function GET() {
  const keys = backendTokenKeys();
  if (!keys) return NextResponse.json({ keys: [] }, { status: 404 });
  return NextResponse.json(publicJwks(keys), { headers: { 'Cache-Control': 'public, max-age=300' } });
}
