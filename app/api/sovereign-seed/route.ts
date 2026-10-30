import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Retired on 23 October 2026.
 *
 * This development seed endpoint used to generate mock forum topics and delete
 * existing records. In production and institutional runtime, mock data synthesis
 * and unauthenticated database mutators are strictly forbidden.
 * Handled with HTTP 410 Gone.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Gone', code: 'SEED_RETIRED', detail: 'Synthetic data seeding is permanently retired.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Gone', code: 'SEED_RETIRED', detail: 'Synthetic data seeding is permanently retired.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
