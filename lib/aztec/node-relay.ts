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
