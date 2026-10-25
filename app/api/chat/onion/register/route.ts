import { getSession } from '@/lib/session';
/**
 * GET/POST /api/chat/onion/register
 *
 * Relay Peer Discovery Registry
 *
 * Maintains a live list of browser sessions that have volunteered
 * to act as onion relay nodes in the Ledger Chat privacy network.
 *
 * GET  — Returns the list of currently active relay nodes (with public keys)
 * POST — Registers or refreshes a relay node's heartbeat
 *
 * Storage Strategy:
 *   - Primary: Upstash Redis (TTL 90s per relay — auto-expires stale nodes)
 *   - Fallback: In-memory Map (for local dev without Redis)
 *
 * Privacy: This registry stores NO IP addresses. Only:
 *   - A relay ID (wallet address or session UUID)
 *   - The relay's ECDH public key (safe to share)
 *   - The relay's public URL
 *   - A lastSeen timestamp
 *
 * Security:
 *   ✅ POST requires a valid JWT session
 *   ✅ GET is public (public key discovery only)
 *   ✅ Public key JWK is validated before storage
 *   ✅ Relay URLs are validated as HTTPS only
 *   ✅ No private keys ever touch this endpoint
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RelayEntry {
  id:        string;
  publicKey: { jwk: JsonWebKey };
  relayUrl:  string;
  lastSeen:  number;
}

// ── Storage ────────────────────────────────────────────────────────────────────

// In-memory fallback (shared across requests in the same process)
declare global {
  var __onionRelayRegistry: Map<string, RelayEntry>;
}
if (!global.__onionRelayRegistry) {
  global.__onionRelayRegistry = new Map();
}

const RELAY_TTL_MS = 90_000; // 90 seconds

function getRegistry(): Map<string, RelayEntry> {
  return global.__onionRelayRegistry;
}

function pruneStale(): void {
  const now = Date.now();
  const reg = getRegistry();
  for (const [id, entry] of reg.entries()) {
    if (now - entry.lastSeen > RELAY_TTL_MS) reg.delete(id);
  }
}

// Optional Upstash Redis for production multi-instance deployment
let _upstash: any = null;
function getUpstash(): any | null {
  if (_upstash) return _upstash;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = require('@upstash/redis');
    _upstash = new Redis({ url, token });
    return _upstash;
  } catch {
    return null;
  }
}

const REDIS_RELAY_KEY = 'ledger_onion_relay_registry';

async function getRelaysFromRedis(): Promise<RelayEntry[]> {
  try {
    const redis = getUpstash();
    if (!redis) return [];
    const raw = await redis.hgetall(REDIS_RELAY_KEY);
    if (!raw) return [];
    const now = Date.now();
    return Object.values(raw)
      .map((v: any) => {
        try { return typeof v === 'string' ? JSON.parse(v) : v; }
        catch { return null; }
      })
      .filter((r): r is RelayEntry => r !== null && now - r.lastSeen < RELAY_TTL_MS);
  } catch {
    return [];
  }
}

async function upsertRelayToRedis(entry: RelayEntry): Promise<void> {
  try {
    const redis = getUpstash();
    if (!redis) return;
    await redis.hset(REDIS_RELAY_KEY, { [entry.id]: JSON.stringify(entry) });
    await redis.expire(REDIS_RELAY_KEY, 300); // 5 min TTL on the hash
  } catch { /* non-critical */ }
}

// ── JWT Auth ───────────────────────────────────────────────────────────────────

async function verifyAuth(req: NextRequest): Promise<string | null> {
  // Check JWT from cookie or Authorization header
  const ledgerCookie = req.cookies.get('ledger_session')?.value ??
                      req.cookies.get('human_session')?.value;
  const bearerToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  const token = ledgerCookie ?? bearerToken;

  if (!token) return null;
  
  try {
    const { verifyJWT } = await import('@/lib/jwt');
    const payload = await verifyJWT(token);
    return (payload.address ?? payload.sub ?? payload.userId) as string | null;
  } catch {
    return null;
  }
}

// ── JWK Validation ────────────────────────────────────────────────────────────

function isValidEcdhPublicKey(jwk: any): boolean {
  return (
    typeof jwk === 'object'  &&
    jwk !== null             &&
    jwk.kty === 'EC'         &&
    jwk.crv === 'P-256'      &&
    typeof jwk.x === 'string'&&
    typeof jwk.y === 'string'&&
    !jwk.d                   // MUST NOT contain private key component
  );
}

// ── Rate Limiting ──────────────────────────────────────────────────────────────

declare global {
  var __registryRateMap: Map<string, { count: number; resetAt: number }>;
}
if (!global.__registryRateMap) global.__registryRateMap = new Map();

function checkRegistryRateLimit(id: string): boolean {
  const now    = Date.now();
  const window = 60_000;
  const limit  = 10; // 10 registrations per minute per identity

  const rec = global.__registryRateMap.get(id);
  if (!rec || now > rec.resetAt) {
    global.__registryRateMap.set(id, { count: 1, resetAt: now + window });
    return true;
  }
  if (rec.count >= limit) return false;
  rec.count++;
  return true;
}

// ── GET: Fetch active relays ──────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse> {
  pruneStale();

  // Try Redis first, fall back to in-memory
  let relays: RelayEntry[] = await getRelaysFromRedis();
  if (relays.length === 0) {
    relays = Array.from(getRegistry().values()).filter(
      (r) => Date.now() - r.lastSeen < RELAY_TTL_MS,
    );
  }

  // Strip any lingering private key data before sending (defence in depth)
  const safe = relays.map((r) => ({
    id:        r.id,
    publicKey: { jwk: r.publicKey.jwk },
    relayUrl:  r.relayUrl,
    lastSeen:  r.lastSeen,
  }));

  return NextResponse.json({ relays: safe, count: safe.length });
}

// ── POST: Register / heartbeat ────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth required to register as relay
  const userId = await verifyAuth(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required to register as a relay node.' },
      { status: 401 },
    );
  }

  // 2. Rate limit
  if (!checkRegistryRateLimit(userId)) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  // 3. Parse body
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  // 4. Validate relay URL
  let relayUrl: URL;
  try { relayUrl = new URL(body.relayUrl); }
  catch { return NextResponse.json({ error: 'Invalid relayUrl.' }, { status: 400 }); }

  if (relayUrl.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'relayUrl must use https:// in production.' },
      { status: 400 },
    );
  }

  // 5. Validate public key (MUST be a valid ECDH P-256 public key, NO private 'd' field)
  // [SECURITY — HIGH-02] Prevent Prototype Pollution
  // Using JSON.stringify -> JSON.parse strips any injected `__proto__` properties
  // ensuring the `isValidEcdhPublicKey` check cannot be bypassed.
  let safeJwk: any;
  try {
    safeJwk = JSON.parse(JSON.stringify(body.publicKey?.jwk ?? {}));
  } catch {
    return NextResponse.json({ error: 'Invalid JWK payload.' }, { status: 400 });
  }

  if (!isValidEcdhPublicKey(safeJwk)) {
    return NextResponse.json(
      { error: 'Invalid or missing ECDH P-256 public key. Private keys are rejected.' },
      { status: 400 },
    );
  }

  // 6. Build the entry
  const entry: RelayEntry = {
    // The relay id is the caller's own identity. It used to come from the
    // body, so anyone could overwrite another user's relay entry with their
    // own key and URL and sit in the middle of that user's onion route.
    id:        String(userId).toLowerCase().slice(0, 64),
    publicKey: { jwk: { kty: 'EC', crv: 'P-256', x: safeJwk.x, y: safeJwk.y } },
    relayUrl:  relayUrl.toString(),
    lastSeen:  Date.now(),
  };

  // 7. Upsert to in-memory registry + Redis
  getRegistry().set(entry.id, entry);
  await upsertRelayToRedis(entry);

  return NextResponse.json({ ok: true, id: entry.id, expiresIn: RELAY_TTL_MS });
}

// ── DELETE: Voluntarily deregister ───────────────────────────────────────────

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const userId = await verifyAuth(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  getRegistry().delete(String(userId).toLowerCase());

  try {
    const redis = getUpstash();
    if (redis) await redis.hdel(RELAY_KEY, String(userId).toLowerCase());
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true, deregistered: userId });
}

const RELAY_KEY = REDIS_RELAY_KEY;
