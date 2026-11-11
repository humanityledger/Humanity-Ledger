/**
 * lib/aztec/wallet/node-fetch.ts
 *
 * The fetch the private wallet's Aztec node client uses.
 *
 * The wallet talks to the public node directly. When that fails at the network level (Safari's
 * "Load failed", Chrome's "Failed to fetch", a 429 or 5xx from the free public endpoint, or an
 * extension that blocks the node's host), the same JSON-RPC request is sent to this site's relay,
 * /api/aztec/node, which forwards it unchanged to the pinned node. The relay is then used for a
 * while, so every request does not pay for a failed direct attempt first.
 *
 * Nothing about trust changes: the relay forwards to the same pinned upstream, and the wallet still
 * checks the node's identity (rollup, L1, Fee Juice pins) on what comes back. The relay is used
 * only when the direct route fails, so in the normal case this site sees none of the wallet's
 * node traffic.
 */

/** Signature of the fetch @aztec-labs/foundation's JSON-RPC client calls (makeFetch's result). */
export type RpcFetch = (
  host: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
  noRetry?: boolean,
) => Promise<{ response: any; headers: any }>;

/**
 * Errors where trying another route can help: the request did not get a usable answer.
 * A JSON-RPC error from the node itself (bad params, a rejected transaction) is not one of these.
 */
const TRANSIENT =
  /Error fetching from host|Load failed|Failed to fetch|NetworkError|network connection was lost|ERR_NETWORK|ERR_BLOCKED|Too Many Requests|\b(429|502|503|504)\b|Bad Gateway|Service Unavailable|Gateway Time-?out|rate.?limit|Failed to parse body as JSON|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up|aborted/i;

export function isTransientNodeError(err: unknown): boolean {
  const e = err as any;
  const text = `${e?.name ?? ''} ${e?.message ?? e ?? ''} ${e?.cause?.message ?? ''}`;
  return TRANSIENT.test(text);
}

/** The relay itself said no (signed out, turned off, too large): not a reason to stay on it. */
function relayRefused(err: unknown): boolean {
  const e = err as any;
  const text = `${e?.message ?? e ?? ''}`;
  return isTransientNodeError(err) || /Unauthori[sz]ed|Forbidden|Authentication required|relay is turned off|Relay refused|could not be reached|No Aztec node is configured|Not Found|Too Large|Unsupported Media|\b(401|403|404|413|415)\b/i.test(text);
}

export interface NodeFetchOptions {
  /** Same-origin relay URL, or null to never use one. */
  relay: string | null;
  /** Fetch with few retries: the direct attempt, so a dead route is given up quickly. */
  fast: RpcFetch;
  /** Fetch with the full retry schedule. */
  patient: RpcFetch;
  /** How long to keep using the relay after the direct route failed. */
  stickyMs?: number;
  now?: () => number;
  onRoute?: (route: 'direct' | 'relay') => void;
}

export function makeNodeFetch(opts: NodeFetchOptions): RpcFetch {
  const { relay, fast, patient } = opts;
  const stickyMs = opts.stickyMs ?? 5 * 60_000;
  const now = opts.now ?? Date.now;
  let relayUntil = 0;

  return async (host, body, extraHeaders, noRetry) => {
    if (!relay || host === relay) return patient(host, body, extraHeaders, noRetry);

    if (now() < relayUntil) {
      try {
        return await patient(relay, body, extraHeaders, noRetry);
      } catch (err) {
        if (!relayRefused(err)) throw err;
        // The relay is down or refused: go back to the direct route.
        relayUntil = 0;
        opts.onRoute?.('direct');
        return patient(host, body, extraHeaders, noRetry);
      }
    }

    try {
      return await fast(host, body, extraHeaders, noRetry);
    } catch (err) {
      if (!isTransientNodeError(err)) throw err;
      relayUntil = now() + stickyMs;
      opts.onRoute?.('relay');
      try {
        return await patient(relay, body, extraHeaders, noRetry);
      } catch (relayErr) {
        if (!relayRefused(relayErr)) throw relayErr; // the node answered, through the relay
        relayUntil = 0;
        throw err; // the direct failure says more about what is wrong
      }
    }
  };
}

/** The relay of this site, when the browser can reach it and the build did not turn it off. */
export function relayUrl(): string | null {
  if (process.env.NEXT_PUBLIC_AZTEC_NODE_RELAY === 'off') return null;
  if (typeof window === 'undefined' || !window.location?.origin) return null;
  return `${window.location.origin}/api/aztec/node`;
}

/** Node client options for the wallet: batch limit of the public endpoint, plus the failover fetch. */
export async function walletNodeClientOptions(maxBatchSize: number): Promise<{ maxBatchSize: number; fetch?: RpcFetch }> {
  const relay = relayUrl();
  if (!relay) return { maxBatchSize };
  const { makeFetch } = (await import('@aztec-labs/foundation/json-rpc/client')) as any;
  if (typeof makeFetch !== 'function') return { maxBatchSize };
  return {
    maxBatchSize,
    fetch: makeNodeFetch({
      relay,
      fast: makeFetch([1], false),
      patient: makeFetch([1, 2, 3], false),
      onRoute: (r) => console.warn(`[wallet] Aztec node route: ${r === 'relay' ? 'via ledgerchat.org relay (direct route failed)' : 'direct'}`),
    }),
  };
}
