import { NextResponse } from 'next/server';

/**
 * B-012: Deprecated SIWE route.
 * Unified into canonical route: POST /api/siwe/verify
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Gone: This endpoint has been unified. Please use /api/siwe/verify.',
      canonicalEndpoint: '/api/siwe/verify',
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Gone: This endpoint has been unified. Please use /api/siwe/verify.',
      canonicalEndpoint: '/api/siwe/verify',
    },
    { status: 410 }
  );
}
