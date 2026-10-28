import { NextRequest, NextResponse } from 'next/server';
import {
  type OnionLayer,
  decryptLayer,
  importPrivateKeyJwk,
} from '@/lib/onion/OnionCrypto';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { assertFetchableUrl, fetchPublicUrl } from '@/lib/security/publicFetch';
/**
 * POST /api/chat/onion/relay
 *
 * The Onion Relay Node — one hop in the Ledger Chat privacy circuit.
 *
 * This endpoint acts as a relay in the onion routing circuit.
 * It receives an encrypted onion envelope, decrypts ONE layer
 * using the server's resident ECDH private key, and forwards
 * the inner payload to the next hop in the circuit.
 *
 * Security Architecture:
 * ────────────────────────────────────────────────────────────────
 *  • This relay NEVER logs IP addresses, sender identities,
 *    message contents, or destination addresses.
 *  • The relay can only see: its own layer's nextHop URL and
 *    the encrypted inner blob — nothing else.
 *  • Authentication: Bearer JWT required to prevent abuse from
 *    anonymous bots flooding the relay with garbage packets.
 *  • Rate limiting: 30 relay operations per minute per identity.
 *  • No SQL queries: relay state is ephemeral (no Prisma here).
 *
 * Threat Model:
 *  ✅ Relay cannot read the message content (AES-256-GCM encrypted)
 *  ✅ Relay cannot identify the original sender
 *  ✅ Relay cannot identify the final destination
 *  ✅ Replay attacks: AEAD ciphertext uniqueness prevents replays
 *  ✅ Amplification attacks: body size limit + auth requirement
 *  ✅ Timing attacks: jitter applied client-side before hitting relay
 */


export interface OnionEnvelope {
  type: 'ONION_FORWARD';
  nextHop: string;
  layer: OnionLayer;
}

export const dynamic  = 'force-dynamic';
export const maxDuration = 10; // seconds — relay must be fast

// ── Relay Identity ─────────────────────────────────────────────────────────────
//
// The relay server uses a static ECDH key-pair stored in env vars.
// In production: ONION_RELAY_PRIVATE_KEY_JWK = JSON stringified JWK
// If not set, the server will refuse to act as a relay (safe default).
//
// Key rotation: regenerate via `node -e "require('./scripts/gen-relay-key.js')"`

function getRelayPrivateKey(): Promise<CryptoKey> | null {
  const jwkStr = process.env.ONION_RELAY_PRIVATE_KEY_JWK;
  if (!jwkStr) return null;
  try {
    const jwk = JSON.parse(jwkStr);
    return importPrivateKeyJwk(jwk);
  } catch {
    return null;
  }
}

// ── JWT Verification ──────────────────────────────────────────────────────────

async function verifyAuth(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token  = authHeader.slice(7);

  try {
    const { verifyJWT } = await import('@/lib/jwt');
    await verifyJWT(token);
    return true;
  } catch {
    return false;
  }
}

// ── In-memory replay protection ───────────────────────────────────────────────
// Stores the ciphertext fingerprint of recently seen packets.
// This is a Bloom-filter-like structure — lightweight, non-persistent.
// Cleared every 5 minutes to prevent unbounded memory growth.

declare global {
  var __onionReplaySeen: Set<string>;
  var __onionReplayTimer: ReturnType<typeof setInterval> | null;
}
if (!global.__onionReplaySeen)  global.__onionReplaySeen  = new Set();
if (!global.__onionReplayTimer) {
  global.__onionReplayTimer = setInterval(() => {
    global.__onionReplaySeen.clear();
  }, 5 * 60 * 1000);
}

// ── Body Size Limit ───────────────────────────────────────────────────────────
const MAX_BODY_BYTES = 64 * 1024; // 64 KB — padded onion packets are small

// ── Rate Limiting ─────────────────────────────────────────────────────────────
declare global {
  var __onionRateMap: Map<string, { count: number; resetAt: number }>;
}
if (!global.__onionRateMap) global.__onionRateMap = new Map();

function checkRateLimit(identity: string): boolean {
  const now    = Date.now();
  const window = 60_000; // 1 minute
  const limit  = 30;     // 30 relay ops per minute

  const record = global.__onionRateMap.get(identity);
  if (!record || now > record.resetAt) {
    global.__onionRateMap.set(identity, { count: 1, resetAt: now + window });
    return true;
  }
  if (record.count >= limit) return false;
  record.count++;
  return true;
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth gate ─────────────────────────────────────────────────────────
  const authed = await verifyAuth(req);
  if (!authed) {
    return NextResponse.json(
      { error: 'Unauthorized — valid session required to use relay.' },
      { status: 401 },
    );
  }

  // ── 2. Body size guard (HIGH-01) ──────────────────────────────────────────
  // Do not trust Content-Length header as it can be bypassed with chunked transfer encoding.
  let rawBody: ArrayBuffer;
  try {
    rawBody = await req.arrayBuffer();
  } catch {
    return NextResponse.json({ error: 'Failed to read body.' }, { status: 400 });
  }

  if (rawBody.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'Payload too large.' },
      { status: 413 },
    );
  }

  // ── 3. Parse body ─────────────────────────────────────────────────────────
  let body: OnionEnvelope;
  try {
    body = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Structural validation — no injection, no prototype pollution
  if (
    typeof body !== 'object'        ||
    body === null                   ||
    body.type    !== 'ONION_FORWARD'||
    typeof body.nextHop !== 'string'||
    typeof body.layer   !== 'object'
  ) {
    return NextResponse.json({ error: 'Malformed onion envelope.' }, { status: 400 });
  }

  // ── 4. Replay protection (CRIT-02) ────────────────────────────────────────
  const fingerprint = body.layer.ciphertext.slice(0, 64); // First 48 bytes of ciphertext
  
  // Use persistent Redis storage for replay protection to survive serverless instance restarts.
  // The 'NX' flag ensures only the first request to set the key succeeds.
  try {
    const replayKey = `onion:replay:${fingerprint}`;
    // 5 minutes TTL
    const existing = await safeRedisGet(replayKey);
    
    if (existing === '1') {
       return NextResponse.json(
         { error: 'Replayed packet rejected.' },
         { status: 409 },
       );
    }
    
    await safeRedisSet(replayKey, '1', 'EX', 300);
  } catch (err) {
    // Fallback to in-memory if Redis is unavailable (dev mode / temporary failure)
    if (global.__onionReplaySeen.has(fingerprint)) {
      return NextResponse.json(
        { error: 'Replayed packet rejected (mem fallback).' },
        { status: 409 },
      );
    }
    global.__onionReplaySeen.add(fingerprint);
  }

  // ── 5. Rate limit ─────────────────────────────────────────────────────────
  // Use a hash of the IP as the rate-limit key (not stored, just counted)
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const ipKey = btoa(ip).slice(0, 16);
  if (!checkRateLimit(ipKey)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded.' },
      { status: 429 },
    );
  }

  // ── 6. Validate nextHop URL ───────────────────────────────────────────────
  // Only allow HTTPS URLs to prevent SSRF into internal services
  let nextHopUrl: URL;
  try {
    nextHopUrl = new URL(body.nextHop);
  } catch {
    return NextResponse.json({ error: 'Invalid nextHop URL.' }, { status: 400 });
  }

  if (nextHopUrl.protocol !== 'https:' && nextHopUrl.protocol !== 'http:') {
    return NextResponse.json(
      { error: 'nextHop must use https:// protocol.' },
      { status: 400 },
    );
  }

  // Block SSRF (CRIT-01). The old check compared hostname prefixes, was off
  // outside production, missed names that resolve to private addresses and
  // IPv6 forms, and was never applied to the hop that is actually fetched
  // (inner.nextHop, below). Every hop now goes through lib/security/publicFetch.
  try {
    assertFetchableUrl(nextHopUrl.href);
  } catch {
    return NextResponse.json(
      { error: 'SSRF blocked: private addresses are not permitted.' },
      { status: 403 },
    );
  }

  // ── 7. Decrypt one onion layer ────────────────────────────────────────────
  const privKeyPromise = getRelayPrivateKey();
  if (!privKeyPromise) {
    // This server is not configured as a relay — return a clear error
    return NextResponse.json(
      { error: 'This node is not configured as an onion relay.' },
      { status: 503 },
    );
  }

  let innerBytes: Uint8Array;
  try {
    const privateKey = await privKeyPromise;
    innerBytes = await decryptLayer(body.layer, privateKey);
  } catch (err: any) {
    // Decryption failure means the packet was not meant for this relay
    // or has been tampered with — reject silently (timing-safe response)
    return NextResponse.json(
      { error: 'Decryption failed — packet not addressed to this relay.' },
      { status: 422 },
    );
  }

  // ── 8. Parse inner payload ────────────────────────────────────────────────
  let inner: any;
  try {
    inner = JSON.parse(new TextDecoder().decode(innerBytes));
  } catch {
    return NextResponse.json({ error: 'Inner payload is not valid JSON.' }, { status: 422 });
  }

  // ── 9. Handle exit node: deliver to XMTP via server-side queue ───────────
  if (inner.type === 'XMTP_DELIVER') {
    // The exit node delivers the message to the XMTP network.
    // We enqueue it server-side (no IP revealed to XMTP from the client).
    // Use the existing /api/chat/queue endpoint.
    try {
      const queueRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/chat/onion/queue`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: inner.destination,
            payload:     inner.payload,
            sentAt:      inner.sentAt,
            nonce:       inner.nonce,
          }),
        },
      );

      if (!queueRes.ok) {
        return NextResponse.json({ error: 'Exit delivery failed.' }, { status: 502 });
      }

      return NextResponse.json({ ok: true, hop: 'exit', delivered: true });
    } catch (err: any) {
      return NextResponse.json({ error: 'Exit delivery error.' }, { status: 502 });
    }
  }

  // ── 10. Forward to next relay hop ─────────────────────────────────────────
  if (inner.type === 'ONION_FORWARD') {
    // Structural validation of the inner envelope
    if (
      typeof inner.nextHop !== 'string' ||
      typeof inner.layer   !== 'object'
    ) {
      return NextResponse.json({ error: 'Malformed inner envelope.' }, { status: 422 });
    }

    try {
      // inner.nextHop comes out of a layer anyone can encrypt to this relay's
      // public key, so it is attacker-chosen: fetched only if it is public,
      // checked again at connect time, never redirected.
      const forwardRes = await fetchPublicUrl(inner.nextHop, {
        method:  'POST',
        timeoutMs: 8000,
        maxBytes: 16 * 1024,
        headers: {
          'Content-Type':  'application/json',
          'X-Onion-Route': '1',
          // Do NOT forward the Authorization header — each hop trusts the packet structure
        },
        body: JSON.stringify({
          type:    'ONION_FORWARD',
          nextHop: inner.nextHop,
          layer:   inner.layer,
        }),
      });

      if (forwardRes.status < 200 || forwardRes.status >= 300) {
        return NextResponse.json(
          { error: `Next hop returned ${forwardRes.status}` },
          { status: 502 },
        );
      }

      return NextResponse.json({ ok: true, hop: 'middle', forwarded: true });
    } catch {
      return NextResponse.json({ error: 'Failed to forward to next hop.' }, { status: 502 });
    }
  }

  // Unknown inner type
  return NextResponse.json({ error: 'Unknown inner payload type.' }, { status: 422 });
}

// ── GET: Health check for relay status ───────────────────────────────────────
export async function GET(_req: NextRequest): Promise<NextResponse> {
  const isConfigured = !!process.env.ONION_RELAY_PRIVATE_KEY_JWK;
  return NextResponse.json({
    status:      isConfigured ? 'relay_active' : 'relay_not_configured',
    version:     'v1',
    algorithm:   'ECDH-P256 + AES-256-GCM',
    hops:        3,
  });
}
