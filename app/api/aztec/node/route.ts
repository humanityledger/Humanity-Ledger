import { NextRequest, NextResponse } from 'next/server';
import {
  RELAY_MAX_BODY_BYTES,
  getPublicRelayCacheSpec,
  recordUpstreamFailure,
  recordUpstreamSuccess,
  relayResponseHeaders,
  relayUpstreams,
  rewireJsonRpcId,
  selectHealthyUpstreams,
  validateRelayBody,
} from '@/lib/aztec/node-relay';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/aztec/node — relays one JSON-RPC request (or a small batch) from the private wallet to
 * the pinned Aztec node, when the browser cannot reach that node directly (lib/aztec/wallet/node-fetch.ts).
 * Signed-in sessions only (middleware). Rules and limits: lib/aztec/node-relay.ts.
 * Set AZTEC_NODE_RELAY=off to turn it off.
 */
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const MAX_L1_CACHE_ENTRIES = 500;

interface CachedRpcResponse {
  bodyText: string;
  headers: Array<[string, string]>;
  status: number;
  expiresAt: number;
}

const publicL1Cache = new Map<string, CachedRpcResponse>();
const inFlightPublicRpc = new Map<string, Promise<CachedRpcResponse | { failStatus: number; message: string }>>();

function setL1Cache(key: string, entry: CachedRpcResponse) {
  if (publicL1Cache.size >= MAX_L1_CACHE_ENTRIES) {
    const oldest = publicL1Cache.keys().next().value;
    if (oldest !== undefined) publicL1Cache.delete(oldest);
  }
  publicL1Cache.set(key, entry);
}

/** Errors in JSON-RPC shape, so the wallet's client reports the message itself. */
function fail(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message } }, { status, headers });
}

async function readLimited(req: NextRequest, limit: number): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

async function forwardToUpstreams(raw: string, upstreams: string[]) {
  const ordered = selectHealthyUpstreams(upstreams);
  let lastStatus = 502;
  for (const upstream of ordered) {
    try {
      const res = await fetch(upstream, {
        method: 'POST',
        // Only what JSON-RPC needs: no cookies, authorization or client headers go upstream.
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: raw,
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      // Rate limited or down: record failure on circuit breaker and try the next upstream.
      if (res.status === 429 || res.status >= 500) {
        lastStatus = res.status;
        recordUpstreamFailure(upstream);
        await res.body?.cancel().catch(() => {});
        continue;
      }
      const length = Number(res.headers.get('content-length') || 0);
      if (length > MAX_RESPONSE_BYTES) {
        await res.body?.cancel().catch(() => {});
        return { ok: false as const, status: 502, message: 'Node response too large.' };
      }
      const body = await res.arrayBuffer();
      if (body.byteLength > MAX_RESPONSE_BYTES) {
        return { ok: false as const, status: 502, message: 'Node response too large.' };
      }
      recordUpstreamSuccess(upstream);
      return { ok: true as const, status: res.status, body, headers: relayResponseHeaders(res.headers) };
    } catch {
      recordUpstreamFailure(upstream);
      lastStatus = 502;
    }
  }
  return {
    ok: false as const,
    status: lastStatus === 429 ? 503 : 502,
    message: 'The Aztec node could not be reached. Try again in a minute.',
    headers: { 'retry-after': '10' },
  };
}

export async function POST(req: NextRequest) {
  if (process.env.AZTEC_NODE_RELAY === 'off') {
    return fail(404, 'The node relay is turned off on this server.');
  }
  const verifiedCaller = req.headers.get('x-verified-session-address')?.trim().toLowerCase();
  const rlKey = verifiedCaller || `ip:${getClientIP(req)}`;
  const rlLimit = verifiedCaller ? 1200 : 120;
  const rl = await checkRateLimit(rlKey, { max: rlLimit, windowSec: 60, prefix: 'rl:aztec_node' });
  if (!rl.allowed) {
    const retryAfter = Math.max(1, rl.resetAt - Math.floor(Date.now() / 1000));
    return fail(429, 'Aztec relay rate limit exceeded. Please retry shortly.', {
      'Retry-After': String(retryAfter),
    });
  }
  const type = req.headers.get('content-type') || '';
  if (!/^application\/json\b/i.test(type)) {
    return fail(415, 'Content-Type must be application/json.');
  }
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > RELAY_MAX_BODY_BYTES) return fail(413, 'Request too large.');

  const raw = await readLimited(req, RELAY_MAX_BODY_BYTES);
  if (raw === null) return fail(413, 'Request too large.');
  const check = validateRelayBody(raw);
  if (!check.ok) return fail(400, `Relay refused the request: ${check.error}`);

  const upstreams = relayUpstreams();
  if (!upstreams.length) return fail(503, 'No Aztec node is configured.');

  // Public shared read-only method path: L1 -> Redis L2 -> single-flight coalesced upstream
  const cacheSpec = getPublicRelayCacheSpec(raw);
  if (cacheSpec) {
    const now = Date.now();
    const l1 = publicL1Cache.get(cacheSpec.cacheKey);
    if (l1 && now < l1.expiresAt) {
      const hdrs = new Headers(l1.headers);
      hdrs.set('x-relay-cache', 'HIT');
      return new NextResponse(rewireJsonRpcId(l1.bodyText, cacheSpec.reqId), { status: l1.status, headers: hdrs });
    }

    const redisKey = `aztec:rpc:v1:${cacheSpec.cacheKey}`;
    const l2Raw = await safeRedisGet(redisKey);
    if (l2Raw && l2Raw !== 'TIMEOUT') {
      try {
        const l2 = JSON.parse(l2Raw) as CachedRpcResponse;
        if (l2 && typeof l2.bodyText === 'string' && Date.now() < l2.expiresAt) {
          setL1Cache(cacheSpec.cacheKey, l2);
          const hdrs = new Headers(l2.headers);
          hdrs.set('x-relay-cache', 'HIT-REDIS');
          return new NextResponse(rewireJsonRpcId(l2.bodyText, cacheSpec.reqId), { status: l2.status, headers: hdrs });
        }
      } catch {}
    }

    let pending = inFlightPublicRpc.get(cacheSpec.cacheKey);
    if (!pending) {
      pending = (async () => {
        const res = await forwardToUpstreams(raw, upstreams);
        if (!res.ok) {
          return { failStatus: res.status, message: res.message };
        }
        const bodyText = new TextDecoder().decode(res.body);
        let hasRpcError = false;
        try {
          const j = JSON.parse(bodyText);
          hasRpcError = Boolean(j?.error);
        } catch {
          hasRpcError = true;
        }
        const entry: CachedRpcResponse = {
          bodyText,
          headers: Array.from(res.headers.entries()),
          status: res.status,
          expiresAt: Date.now() + cacheSpec.ttlMs,
        };
        if (res.status === 200 && !hasRpcError) {
          setL1Cache(cacheSpec.cacheKey, entry);
          const ttlSec = Math.max(1, Math.ceil(cacheSpec.ttlMs / 1000));
          void safeRedisSet(redisKey, JSON.stringify(entry), 'EX', ttlSec).catch(() => {});
        }
        return entry;
      })().finally(() => {
        inFlightPublicRpc.delete(cacheSpec.cacheKey);
      });
      inFlightPublicRpc.set(cacheSpec.cacheKey, pending);
    }

    const resolved = await pending;
    if ('failStatus' in resolved) {
      return fail(resolved.failStatus, resolved.message, { 'retry-after': '10' });
    }
    const hdrs = new Headers(resolved.headers);
    return new NextResponse(rewireJsonRpcId(resolved.bodyText, cacheSpec.reqId), {
      status: resolved.status,
      headers: hdrs,
    });
  }

  // Private/tx/batch calls always stream directly without caching or coalescing
  const directRes = await forwardToUpstreams(raw, upstreams);
  if (!directRes.ok) {
    return fail(directRes.status, directRes.message, directRes.headers);
  }
  return new NextResponse(directRes.body, { status: directRes.status, headers: directRes.headers });
}
