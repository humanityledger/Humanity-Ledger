/**
 * lib/admin-guard.ts
 * 
 * Sovereign-grade authorization guard for all /api/admin/* routes.
 *
 * Strategy:
 *   1. Header-based secret: `X-Admin-Secret: <ADMIN_SECRET env var>`  used for
 *      server-to-server calls (e.g. CI pipelines, Railway admin scripts).
 *   2. Query-param fallback: `?secret=<ADMIN_SECRET>`  for simple curl invocations
 *      during development. Disabled in production (NODE_ENV=production) to prevent
 *      secrets from appearing in server access logs.
 *
 * Usage:
 *   import { requireAdmin } from '@/lib/admin-guard';
 *   export async function POST(req: Request) {
 *     const deny = requireAdmin(req);
 *     if (deny) return deny;
 *     // ... rest of handler
 *   }
 * 
 */

import { NextResponse } from 'next/server';

const ADMIN_SECRET = process.env.ADMIN_SECRET;

/**
 * Returns a 401/403 NextResponse if the request is not authorized,
 * or `null` if it passes  allowing the handler to continue.
 */
export function requireAdmin(req: Request): NextResponse | null {
    // No ADMIN_SECRET means no admin access, in every environment. Development
    // used to pass straight through, which left /api/admin/nuke-tickets (it
    // deletes users) open to anyone who could reach the dev server, and the
    // dev server listens on the local network.
    if (!ADMIN_SECRET) {
        console.error('[AdminGuard] ADMIN_SECRET is not set. Blocking all admin access.');
        return NextResponse.json(
            { error: 'Admin endpoint is not configured. Set ADMIN_SECRET.' },
            { status: 503 }
        );
    }

    // Strategy 1: X-Admin-Secret header (preferred)
    const headerSecret = req.headers.get('x-admin-secret');
    if (headerSecret && timingSafeEqual(headerSecret, ADMIN_SECRET)) {
        return null; // Authorized
    }

    // Strategy 2: Query param  development only
    if (process.env.NODE_ENV !== 'production') {
        const url = new URL(req.url);
        const querySecret = url.searchParams.get('secret');
        if (querySecret && timingSafeEqual(querySecret, ADMIN_SECRET)) {
            return null; // Authorized
        }
    }

    console.warn(`[AdminGuard] Unauthorized admin access attempt: ${new URL(req.url).pathname}`);
    return NextResponse.json(
        { error: 'Unauthorized. Valid X-Admin-Secret header required.' },
        { status: 401 }
    );
}

/**
 * Timing-safe string comparison to prevent timing attacks on secret comparison.
 * Uses a constant-time algorithm compatible with the browser's Web Crypto API.
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const aBytes = new TextEncoder().encode(a);
    const bBytes = new TextEncoder().encode(b);
    let diff = 0;
    for (let i = 0; i < aBytes.length; i++) {
        diff |= aBytes[i] ^ bBytes[i];
    }
    return diff === 0;
}
