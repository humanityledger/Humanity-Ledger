import { NextResponse } from 'next/server';
import { getIntegrityManifest } from '@/lib/security/integrity';

export const dynamic = 'force-static';
export const revalidate = 3600;

/**
 * GET /api/security/integrity
 *
 * Public: the aztec-nr contracts the product proves with, each with the SHA-256 of its
 * committed artifact, and what was retired (lib/security/integrity.ts).
 */
export async function GET() {
  const manifest = getIntegrityManifest();
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
