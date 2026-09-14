// @ts-nocheck
/**
 * middleware.ts — Ledger Network Identity Perimeter
 * ─────────────────────────────────────────────────
 * Edge Middleware (runs before EVERY request, on Vercel/Railway Edge runtime).
 *
 * Implements the Identity Gate described by Axel Maisonneuve:
 *
 *   "If we have the entire system tied to a supply of 200 unique identities
 *    that ONLY THOSE PEOPLE can see and have permission across the entire
 *    domain — because they are unique and have signed."
 *
 * Attack vectors closed:
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ VECTOR                   │ DEFENSE                        │
 *  ├──────────────────────────┼────────────────────────────────┤
 *  │ Proxy farm + new wallets │ No airdrop claim = no access   │
 *  │ Tab flooding             │ Every route checks session JWT │
 *  │ Cookie spoofing          │ JWT signed with JWT_SECRET     │
 *  │ IP rotation              │ Identity is on-chain, not IP   │
 *  │ Replay attacks           │ JWT exp + signed nonce per tx  │
 *  └──────────────────────────┴────────────────────────────────┘
 *
 * Architecture:
 *  This middleware runs at EDGE LEVEL (no Node.js APIs, no Prisma).
 *  It performs a lightweight JWT session check ONLY.
 *  The heavy identity verification (DB airdrop claim check) happens
 *  inside each API route via assertVerifiedIdentity().
 *
 *  Why this split?
 *   - Edge middleware has a 1MB code size limit → no Prisma/pg driver.
 *   - JWT check is O(1) crypto — sufficient to block unauthenticated flooding.
 *   - DB identity check happens once per meaningful action, not every request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// ── Public routes: accessible to EVERYONE (no auth required) ──────────────────
const PUBLIC_PATHS = new Set([
  '/',
  '/sign-in',
  '/sign-up',
  '/login',
  '/auth',
  '/connect',
  '/chat',       // LedgerChat handles its own auth internally (XMTP + MetaMask)
  '/manifest.json',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]);

const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/aztec/airdrop',
  '/api/aztec/balance',
  '/api/aztec/transactions',
  '/api/aztec/derive-address',
  '/api/aztec/identity-status',
  '/api/aztec/restore-session',
  '/api/payments/checkout',
  '/api/webhooks/stripe',
  '/api/webhooks/',
  '/api/dev/deploy',
  '/api/aztec/deploy-token',
  '/api/health',
  '/api/status',
  '/api/registry/',
  '/api/humanidfi/',
  '/api/chat/',          // All chat API endpoints (contacts, messages, etc.)
  '/api/call/',          // Group call room API
  '/api/provenance/',    // Provenance log API called on XMTP connect
  '/api/notifications/', // Notification inbox
  '/api/chat/users/search',
  '/_next/',
  '/connect',
  '/legal/',
  '/docs/',
  '/fonts/',
  '/images/',
  '/icons/',
  '/static/',
  '/opengraph',
  '/scan/',
  '/lottie/',
  '/sounds/',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

// ── Rate Limiting (Edge Memory) ──────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();
function applyRateLimit(ip: string, pathname: string): NextResponse | null {
  // Allow 150 requests per minute per IP for API routes
  const LIMIT = 150;
  const WINDOW_MS = 60 * 1000;
  
  const now = Date.now();
  const key = `${ip}`; // global IP limit across all routes

  let record = rateLimitMap.get(key);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + WINDOW_MS };
    rateLimitMap.set(key, record);
  } else {
    record.count++;
  }

  // Optional cleanup to prevent memory leak in long-running edge isolate
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetTime) rateLimitMap.delete(k);
    }
  }

  if (record.count > LIMIT) {
    return NextResponse.json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.'
    }, { status: 429, headers: { 'Retry-After': String(Math.ceil((record.resetTime - now) / 1000)) } });
  }

  return null;
}

// ── JWT Secret (Edge-compatible — TextEncoder only) ─────────────────────────
function getEdgeSecret(): Uint8Array {
  // We can't import requireSecret easily in edge middleware without messing up bundle,
  // so we inline the fail closed logic.
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET is not defined.');
  }
  return new TextEncoder().encode(secret);
}

// ── Extract session JWT from cookies ─────────────────────────────────────────
async function extractSessionAddress(req: NextRequest): Promise<string | null> {
  // Priority 1: SIWE ledger session
  const ledgerCookie = req.cookies.get('humanity_session')?.value
    ?? req.cookies.get('ledger_session')?.value
    ?? req.cookies.get('human_session')?.value;

  if (ledgerCookie) {
    try {
      const isEdDSA = !!process.env.JWT_EDDSA_PUBLIC_JWK;
      let payload;
      
      if (isEdDSA) {
        const { importJWK } = await import('jose');
        const pubJwk = JSON.parse(process.env.JWT_EDDSA_PUBLIC_JWK!);
        const publicKey = await importJWK(pubJwk, 'EdDSA');
        const result = await jwtVerify(ledgerCookie, publicKey, { algorithms: ['EdDSA'] });
        payload = result.payload;
      } else {
        const result = await jwtVerify(ledgerCookie, getEdgeSecret(), { algorithms: ['HS256'] });
        payload = result.payload;
      }
      
      const addr = (payload as any).address ?? (payload as any).sub;
      if (addr && typeof addr === 'string') return addr.toLowerCase();
    } catch {
      // Expired or invalid JWT — fall through
    }
  }

  // Priority 2: Email/standard access token
  const accessToken = req.cookies.get('human.access-token')?.value;
  if (accessToken) {
    try {
      const { payload } = await jwtVerify(accessToken, getEdgeSecret());
      const userId = (payload as any).userId;
      if (userId && typeof userId === 'string') return userId.toLowerCase();
    } catch {
      // Expired or invalid JWT
    }
  }

  return null;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // 1. Edge Rate Limiting for ALL API Routes
  if (pathname.startsWith('/api/')) {
    const ip = req.headers.get('x-forwarded-for') || (req as any).ip || '127.0.0.1';
    const clientIp = ip.split(',')[0].trim();
    const rateLimitRes = applyRateLimit(clientIp, pathname);
    if (rateLimitRes) return rateLimitRes;
  }

  // 2. Allow all public paths through immediately
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }


  // Strict enforcement: ONLY /chat and /portfolio are allowed for authenticated users.
  // /terminal is strictly redirected to /chat. /hub is allowed.
  if (pathname === '/terminal' || pathname.startsWith('/terminal/') ) {
    return NextResponse.redirect(new URL('/chat', req.url));
  }

  // [FASE 3: App Hub Lock]
  const LOCKED_ROUTES = ['/dashboard', '/markets', '/studio', '/governance', '/network', '/academy', '/qds'];
  if (LOCKED_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/chat', req.url));
  }

  // [FASE 18: OFAC / Restricted Jurisdiction Geofencing]
  // Blocks IP addresses from the US and OFAC-sanctioned countries at the edge for PROTECTED app routes.
  const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || '';
  const RESTRICTED_COUNTRIES = ['US', 'CU', 'IR', 'KP', 'SY', 'RU', 'BY'];
  
  if (country && RESTRICTED_COUNTRIES.includes(country.toUpperCase())) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Service Restricted</title>
       <meta name="viewport" content="width=device-width, initial-scale=1">
       <style>
         body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fafafa; color: #111; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
         .card { max-w: 500px; padding: 40px; background: #fff; border: 1px solid #eaeaea; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
         h2 { margin-top: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
         p { color: #666; line-height: 1.6; margin-bottom: 24px; }
         a { display: inline-block; padding: 10px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; }
       </style>
       </head><body>
       <div class="card">
         <h2>Unavailable in ${country}</h2>
         <p>Humanity Ledger application services are currently unavailable in your jurisdiction due to regulatory restrictions.</p>
         <a href="/">Return to Home</a>
       </div>
       </body></html>`,
      { status: 451, headers: { 'content-type': 'text/html' } }
    );
  }

  // 3. Check for a valid session JWT
  const sessionAddress = await extractSessionAddress(req);

  if (!sessionAddress) {
    // No session at all → redirect to sign-in (for pages) or 401 (for API)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Authentication required.',
          code: 'NO_SESSION',
          hint: 'Connect your wallet and claim your Sovereign Identity at /sign-in',
        },
        { status: 401 }
      );
    }
    const signInUrl = new URL('/connect', req.url);
    signInUrl.searchParams.set('redirect', pathname);
    // Use 303 See Other to force the browser to change POST/PUT to GET
    // This fixes the HTTP 405 Method Not Allowed error when NextAuth or Server Actions
    // hit an unauthenticated route and get redirected to a Page.
    return NextResponse.redirect(signInUrl, 303);
  }

  // 3. Session exists → pass the address to downstream handlers via header
  //    [ZK-ALIGNMENT] The middleware injects verified session metadata securely.
  //    The heavy DB identity-gate check (assertVerifiedIdentity) runs inside
  //    each sensitive API route — not here — to keep edge latency minimal.
  //
  //    Headers injected:
  //      x-verified-session-address → cryptographically verified wallet address
  //      x-session-ts               → timestamp for replay-attack detection in routes
  //      x-request-id               → unique request correlation ID for audit trail
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-verified-session-address', sessionAddress);
  requestHeaders.set('x-session-ts', String(Date.now()));
  const requestId = crypto.randomUUID?.() ?? 
eq__;
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('x-request-id', requestId);

  // [SECURITY] Strict CSP — unsafe-eval removed (was allowing arbitrary JS execution)
  // unsafe-inline kept only for Next.js inline hydration scripts (required for App Router)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
  );

  // [SECURITY] Additional hardening headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(self)');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT static files and Next.js internals.
     * This runs for all pages and API routes.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|fonts|images|icons).*)',
  ],
};

