import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * DEPRECATED / RETIRED ENDPOINT
 * Setup assets staging route was for local initial bootstrapping only.
 * Locked in production to prevent arbitrary file copies and path traversal.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Endpoint Locked (410 Gone)',
      reason: 'Local asset staging route is permanently retired.',
    },
    { status: 410 }
  );
}
