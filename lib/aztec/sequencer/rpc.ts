/**
 * Minimal JSON-RPC transport for an Aztec node (`aztec_*` namespace, v6).
 *
 * - Hard timeout per call.
 * - One retry on network errors and 5xx (not on JSON-RPC errors: a method
 *   the node refuses will refuse again).
 * - A circuit breaker per endpoint, so a dead node costs one fast failure
 *   instead of a timeout on every dashboard refresh.
 * - URLs come only from server configuration, never from a request.
 */

export class AztecRpcError extends Error {
  constructor(message: string, readonly code?: number, readonly retriable = false) {
    super(message);
    this.name = 'AztecRpcError';
  }
}

interface Breaker {
  failures: number;
  openUntil: number;
}

const FAILURE_THRESHOLD = 5;
const OPEN_MS = 30_000;
const breakers = new Map<string, Breaker>();

function breakerFor(url: string): Breaker {
  let b = breakers.get(url);
  if (!b) { b = { failures: 0, openUntil: 0 }; breakers.set(url, b); }
  return b;
}

/** For tests. */
export function resetBreakers(): void {
  breakers.clear();
}

let nextId = 1;

async function once<T>(url: string, method: string, params: unknown[], timeoutMs: number): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError' ? `timed out after ${timeoutMs} ms` : (e as Error)?.message || String(e);
    throw new AztecRpcError(`${method}: ${msg}`, undefined, true);
  }
  let body: any = null;
  try { body = await res.json(); } catch { /* fallthrough */ }
  if (body && body.error) {
    throw new AztecRpcError(`${method}: ${body.error.message ?? 'error'}`, body.error.code, false);
  }
  if (!res.ok) throw new AztecRpcError(`${method}: HTTP ${res.status}`, res.status, res.status >= 500 || res.status === 429);
  if (!body || !('result' in body)) throw new AztecRpcError(`${method}: malformed response`, undefined, true);
  return body.result as T;
}

export async function aztecRpc<T>(url: string, method: string, params: unknown[] = [], timeoutMs = 8_000): Promise<T> {
  const b = breakerFor(url);
  if (Date.now() < b.openUntil) {
    throw new AztecRpcError(`${method}: node unreachable, retrying after ${Math.ceil((b.openUntil - Date.now()) / 1000)} s`, undefined, true);
  }
  try {
    let result: T;
    try {
      result = await once<T>(url, method, params, timeoutMs);
    } catch (e) {
      if (!(e instanceof AztecRpcError) || !e.retriable) throw e;
      await new Promise(r => setTimeout(r, 250));
      result = await once<T>(url, method, params, timeoutMs);
    }
    b.failures = 0;
    return result;
  } catch (e) {
    // Only transport failures trip the breaker; "method not available" does not.
    if (e instanceof AztecRpcError && e.retriable) {
      b.failures += 1;
      if (b.failures >= FAILURE_THRESHOLD) { b.openUntil = Date.now() + OPEN_MS; b.failures = 0; }
    }
    throw e;
  }
}

/** GET <node>/status: answers 200 even while the node is in v6 standby mode. */
export async function nodeStatusOk(url: string, timeoutMs = 5_000): Promise<boolean> {
  try {
    const res = await fetch(url.replace(/\/+$/, '') + '/status', { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}
