import { NextResponse } from 'next/server';
import { parseValueMode } from '@/lib/aztec/value-mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/aztec/value-mode: whether new private value may enter (lib/aztec/value-mode.ts). Public, no user data. */
export function GET() {
  return NextResponse.json(
    { mode: parseValueMode(process.env.AZTEC_VALUE_MODE) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
