import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 410 Gone: /api/auth/verify has been retired.
 * Email code verification is handled securely by /api/auth/verify-code
 * with atomic Redis rate limiting and brute-force lockout protection.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Endpoint retired',
      message: 'This authentication endpoint has been retired. Please use /api/auth/verify-code.',
    },
    { status: 410 }
  );
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Endpoint retired',
      message: 'This authentication endpoint has been retired. Please use /api/auth/verify-code.',
    },
    { status: 410 }
  );
}
