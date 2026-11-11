import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 410 Gone: /api/auth/verify has been retired.
 * Retired. Sign-in is wallet only (SIWE) or a linked phone
 * with atomic Redis rate limiting and brute-force lockout protection.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Endpoint retired',
      message: 'This authentication endpoint has been retired. Sign in with a wallet at /connect.',
    },
    { status: 410 }
  );
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Endpoint retired',
      message: 'This authentication endpoint has been retired. Sign in with a wallet at /connect.',
    },
    { status: 410 }
  );
}
