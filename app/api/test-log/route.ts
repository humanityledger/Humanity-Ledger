import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * DEPRECATED / RETIRED ENDPOINT
 * Direct log appending to local filesystem is disabled to prevent disk exhaustion.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Endpoint Locked (410 Gone)',
      reason: 'Direct file logging endpoint is permanently retired.',
    },
    { status: 410 }
  );
}
