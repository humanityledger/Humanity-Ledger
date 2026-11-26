import { NextResponse } from 'next/server';

/**
 * Retired: Ledger Chat sells no plans, so this billing endpoint has no live
 * use. The middleware answers 410 first (lib/security/retiredRoutes.ts); this
 * stub keeps the old handler (client-set prices, owner upgrade, dummy bank
 * details) from ever running again if the route list changes.
 */
const gone = () => NextResponse.json({ error: 'Gone', message: 'This endpoint has been retired.' }, { status: 410 });

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;
