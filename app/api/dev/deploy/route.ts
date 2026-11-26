import { NextResponse } from 'next/server';

/**
 * Retired: an internal admin/dev endpoint with no production use. The middleware answers 410 first (lib/security/retiredRoutes.ts); this
 * stub keeps the old handler from ever running again if the route list changes.
 */
const gone = () => NextResponse.json({ error: 'Gone', message: 'This endpoint has been retired.' }, { status: 410 });

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;
