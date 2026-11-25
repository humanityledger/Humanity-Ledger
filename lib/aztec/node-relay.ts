/**
 * lib/aztec/node-relay.ts
 *
 * Rules of /api/aztec/node, the same-origin relay the private wallet falls back to when it cannot
 * reach the public Aztec node directly (lib/aztec/wallet/node-fetch.ts).
 *
 * It is not an open proxy:
 *   - the upstream comes only from server configuration, never from the request (no SSRF);
 *   - only JSON-RPC calls in the public `aztec_` node namespace pass (no admin or debug namespaces);
 *   - batches and bodies are bounded, and the route needs a signed-in session (middleware);
 *   - no cookie, authorization or client header is forwarded upstream.
 *
 * Scale hardening (3M+ users):
 *   - Per-upstream circuit breaker automatically isolates unhealthy/429 endpoints across fallback pools.
 *   - Strict read-only public method allowlist for short-TTL shared caching and single-flight coalescing;
 *     private queries, proofs, and tx submissions are NEVER cached.
 */
import { AZTEC_NETWORKS } from './sequencer/networks';

/** Large enough for a transaction with its proof; anything bigger is refused before parsing. */
export const RELAY_MAX_BODY_BYTES = 8 * 1024 * 1024;
/** The wallet batches at most 3 (public endpoint limit); a little headroom, never unbounded. */
export const RELAY_MAX_BATCH = 10;
const METHOD_RE = /^aztec_[A-Za-z][A-Za-z0-9]{0,63}$/;

export type RelayCheck = { ok: true; calls: number } | { ok: false; error: string };

export function validateRelayBody(raw: string, maxBatch = RELAY_MAX_BATCH): RelayCheck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Body is not JSON.' };
  }
  const calls = Array.isArray(parsed) ? parsed : [parsed];
  if (calls.length === 0) return { ok: false, error: 'Empty batch.' };
  if (calls.length > maxBatch) return { ok: false, error: `Batch larger than ${maxBatch}.` };
  for (const c of calls) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { ok: false, error: 'Each call must be a JSON-RPC object.' };
    const call = c as Record<string, unknown>;
    if (call.jsonrpc !== undefined && call.jsonrpc !== '2.0') return { ok: false, error: 'Only JSON-RPC 2.0.' };
    if (typeof call.method !== 'string' || !METHOD_RE.test(call.method)) return { ok: false, error: 'Only public aztec_ node methods.' };
    if (call.params !== undefined && (call.params === null || typeof call.params !== 'object')) return { ok: false, error: 'Params must be an array or object.' };
    const id = call.id;
    if (id !== undefined && id !== null && typeof id !== 'number' && typeof id !== 'string') return { ok: false, error: 'Invalid id.' };
  }
  return { ok: true, calls: calls.length };
}

function cleanUpstream(u: string): string | null {
  try {
    const url = new URL(u.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/**
 * Upstreams in order of preference. AZTEC_NODE_RELAY_UPSTREAMS (comma-separated, server only)
 * overrides; otherwise the node the browser build talks to, so the relay never points somewhere
 * the wallet was not already configured to trust.
 */
export function relayUpstreams(env: Record<string, string | undefined> = process.env): string[] {
  const network = env.NEXT_PUBLIC_AZTEC_NETWORK === 'alpha' ? 'mainnet' : 'testnet';
  const listed = (env.AZTEC_NODE_RELAY_UPSTREAMS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const base = listed.length ? listed : [env.NEXT_PUBLIC_AZTEC_NODE_URL || AZTEC_NETWORKS[network].publicNodeRpc];
  const out: string[] = [];
  for (const u of base) {
    const c = cleanUpstream(u);
    if (c && !out.includes(c)) out.push(c);
  }
  return out.slice(0, 4);
}

/** Response headers passed back: the body type and the node's own version headers. */
export function relayResponseHeaders(upstream: Headers): Headers {
  const out = new Headers({ 'content-type': upstream.get('content-type') || 'application/json', 'cache-control': 'no-store' });
  upstream.forEach((value, key) => {
    if (/^x-aztec-/i.test(key)) out.set(key, value);
  });
  return out;
}

// ── Circuit Breaker per Upstream ─────────────────────────────────────────────

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 30_000;

interface CircuitState {
  failures: number;
  openUntil: number;
}

const upstreamCircuits = new Map<string, CircuitState>();

export function recordUpstreamSuccess(upstream: string): void {
  upstreamCircuits.delete(upstream);
}

export function recordUpstreamFailure(upstream: string, now: number = Date.now()): void {
  const cur = upstreamCircuits.get(upstream) ?? { failures: 0, openUntil: 0 };
  cur.failures += 1;
  if (cur.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    cur.openUntil = now + CIRCUIT_OPEN_MS;
  }
  upstreamCircuits.set(upstream, cur);
}

export function selectHealthyUpstreams(upstreams: string[], now: number = Date.now()): string[] {
  const healthy: string[] = [];
  const open: string[] = [];
  for (const u of upstreams) {
    const state = upstreamCircuits.get(u);
    if (!state || now >= state.openUntil) {
      healthy.push(u);
    } else {
      open.push(u);
    }
  }
  return healthy.length > 0 ? [...healthy, ...open] : open;
}

export function getUpstreamCircuitState(upstream: string): CircuitState | undefined {
  return upstreamCircuits.get(upstream);
}

export function _resetRelayCircuitForTests(): void {
  upstreamCircuits.clear();
}

// ── Public Read-Only Cache & Single-Flight Policy ────────────────────────────

export const AZTEC_PUBLIC_CACHE_TTL_MS: Readonly<Record<string, number>> = {
  aztec_getNodeInfo: 15_000,
  aztec_getL1ContractAddresses: 30_000,
  aztec_getProtocolContractAddresses: 30_000,
  aztec_getCurrentBaseFees: 4_000,
  aztec_getBlockNumber: 2_000,
  aztec_getProvenBlockNumber: 3_000,
  aztec_getTips: 2_000,
  aztec_getBlock: 30_000,
  aztec_getBlockHeader: 30_000,
};

export interface PublicRelayCacheSpec {
  cacheKey: string;
  method: string;
  reqId: string | number | null;
  ttlMs: number;
}

/**
 * Returns cache specification ONLY for single, public, immutable/chain-global read calls.
 * Never matches batches, transaction submissions, simulations, or private note/nullifier calls.
 */
export function getPublicRelayCacheSpec(rawBody: string): PublicRelayCacheSpec | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const call = parsed as Record<string, unknown>;
  const method = typeof call.method === 'string' ? call.method : '';
  const ttlMs = AZTEC_PUBLIC_CACHE_TTL_MS[method];
  if (!ttlMs) return null;

  // For block/header queries, only cache explicit integer block queries (never 'latest')
  if (method === 'aztec_getBlock' || method === 'aztec_getBlockHeader') {
    const params = Array.isArray(call.params) ? call.params : [];
    const blockArg = params[0];
    if (typeof blockArg !== 'number' && !/^\d+$/.test(String(blockArg ?? ''))) {
      return null;
    }
  }

  const paramsJson = JSON.stringify(call.params ?? []);
  const reqId = (typeof call.id === 'number' || typeof call.id === 'string' || call.id === null)
    ? call.id
    : null;

  return {
    cacheKey: `${method}:${paramsJson}`,
    method,
    reqId,
    ttlMs,
  };
}

/**
 * Stamps caller's JSON-RPC `id` onto a cached/coalesced JSON-RPC response body.
 */
export function rewireJsonRpcId(bodyText: string, reqId: string | number | null): string {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return bodyText;
    return JSON.stringify({ ...parsed, id: reqId });
  } catch {
    return bodyText;
  }
}
