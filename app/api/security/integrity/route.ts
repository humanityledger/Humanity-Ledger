import { NextResponse } from 'next/server';
import { getProvingIntegrityManifest } from '@/lib/security/integrity';

export const dynamic = 'force-static';
export const revalidate = 3600;

/**
 * GET /api/security/integrity
 *
 * Public endpoint exposing cryptographic integrity checksums and verification
 * key hashes for client-side proving bundles and circuits.
 */
export async function GET() {
  const manifest = getProvingIntegrityManifest();
  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
