/**
 * The private wallet reaches the Aztec node even when the direct route fails (Safari "Load failed",
 * a rate-limited public endpoint, an extension blocking the host), through a relay that is not an
 * open proxy. lib/aztec/wallet/node-fetch.ts, lib/aztec/node-relay.ts, app/api/aztec/node/route.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isTransientNodeError, makeNodeFetch, type RpcFetch } from '@/lib/aztec/wallet/node-fetch';
import { relayResponseHeaders, relayUpstreams, validateRelayBody, RELAY_MAX_BATCH } from '@/lib/aztec/node-relay';

const DIRECT = 'https://aztec-mainnet.drpc.org';
const RELAY = 'https://ledgerchat.org/api/aztec/node';
const ok = (host: string) => ({ response: { result: host }, headers: new Headers() });

function routes(fail: Set<string>, err = new Error(`Error fetching from host ${DIRECT}: Load failed`)) {
  const calls: string[] = [];
  const f: RpcFetch = async (host) => {
    calls.push(host);
    if (fail.has(host)) throw err;
    return ok(host);
  };
  return { calls, f };
}

describe('node fetch: direct first, relay when the direct route fails', () => {
  it('uses the direct route when it works, and never touches the relay', async () => {
    const { calls, f } = routes(new Set());
    const fetch = makeNodeFetch({ relay: RELAY, fast: f, patient: f });
    expect((await fetch(DIRECT, {})).response.result).toBe(DIRECT);
    expect(calls).toEqual([DIRECT]);
  });

  it('falls back to the relay on a network failure, then stays on it for a while', async () => {
    const fail = new Set([DIRECT]);
    const { calls, f } = routes(fail);
    let t = 0;
    const fetch = makeNodeFetch({ relay: RELAY, fast: f, patient: f, now: () => t, stickyMs: 1000 });
    expect((await fetch(DIRECT, {})).response.result).toBe(RELAY);
    expect((await fetch(DIRECT, {})).response.result).toBe(RELAY);
    expect(calls).toEqual([DIRECT, RELAY, RELAY]);
    // After the sticky window the direct route is tried again.
    fail.clear();
    t = 2000;
    expect((await fetch(DIRECT, {})).response.result).toBe(DIRECT);
  });

  it('goes back to the direct route when the relay is down too', async () => {
    const fail = new Set([DIRECT]);
    const { f } = routes(fail);
    const fetch = makeNodeFetch({ relay: RELAY, fast: f, patient: f, now: () => 0 });
    await fetch(DIRECT, {});
    fail.clear();
    fail.add(RELAY);
    expect((await fetch(DIRECT, {})).response.result).toBe(DIRECT);
  });

  it('a relay that refuses (signed out, turned off) never hides the direct failure', async () => {
    const calls: string[] = [];
    const direct = new Error(`Error fetching from host ${DIRECT}: Load failed`);
    const f: RpcFetch = async (host) => {
      calls.push(host);
      if (host === DIRECT) throw direct;
      throw new Error('Authentication required.');
    };
    const fetch = makeNodeFetch({ relay: RELAY, fast: f, patient: f, now: () => 0 });
    await expect(fetch(DIRECT, {})).rejects.toThrow(/Load failed/);
    // Not stuck on the refusing relay: the next call tries the direct route first again.
    await expect(fetch(DIRECT, {})).rejects.toThrow(/Load failed/);
    expect(calls).toEqual([DIRECT, RELAY, DIRECT, RELAY]);
  });

  it('a node error that comes back through the relay is reported as it is', async () => {
    const f: RpcFetch = async (host) => {
      if (host === DIRECT) throw new TypeError('Load failed');
      throw new Error('Invalid params: tx not found');
    };
    const fetch = makeNodeFetch({ relay: RELAY, fast: f, patient: f });
    await expect(fetch(DIRECT, {})).rejects.toThrow(/Invalid params/);
  });

  it('does not reroute an answer from the node itself (a JSON-RPC error)', async () => {
    const { calls, f } = routes(new Set([DIRECT]), new Error('Invalid params: tx not found'));
    const fetch = makeNodeFetch({ relay: RELAY, fast: f, patient: f });
    await expect(fetch(DIRECT, {})).rejects.toThrow(/Invalid params/);
    expect(calls).toEqual([DIRECT]);
  });

  it('without a relay it is the plain patient fetch', async () => {
    const patient = vi.fn(async (h: string) => ok(h));
    const fetch = makeNodeFetch({ relay: null, fast: vi.fn(), patient });
    await fetch(DIRECT, {});
    expect(patient).toHaveBeenCalledTimes(1);
  });

  it('knows the browsers\' words for a failed request', () => {
    for (const m of ['Load failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.', 'The network connection was lost.', 'Too Many Requests', 'Error fetching from host https://x: boom', '503 Service Unavailable']) {
      expect(isTransientNodeError(new TypeError(m))).toBe(true);
    }
    for (const m of ['Invalid params', 'Assertion failed: Balance too low', 'existing nullifier']) {
      expect(isTransientNodeError(new Error(m))).toBe(false);
    }
  });
});

describe('node relay: not an open proxy', () => {
  const call = (method: string, extra: Record<string, unknown> = {}) => JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [], ...extra });

  it('accepts public aztec_ node calls and small batches', () => {
    expect(validateRelayBody(call('aztec_getNodeInfo'))).toEqual({ ok: true, calls: 1 });
    const batch = JSON.stringify([1, 2, 3].map((id) => ({ jsonrpc: '2.0', id, method: 'aztec_getBlockNumber', params: [] })));
    expect(validateRelayBody(batch)).toEqual({ ok: true, calls: 3 });
  });

  it('refuses other namespaces, bad shapes and big batches', () => {
    for (const m of ['nodeAdmin_setConfig', 'eth_sendRawTransaction', 'aztec_', 'aztec_get-x', 'debug_trace', '__proto__']) {
      expect(validateRelayBody(call(m)).ok).toBe(false);
    }
    expect(validateRelayBody('not json').ok).toBe(false);
    expect(validateRelayBody('[]').ok).toBe(false);
    expect(validateRelayBody('"aztec_getNodeInfo"').ok).toBe(false);
    expect(validateRelayBody(call('aztec_getNodeInfo', { jsonrpc: '1.0' })).ok).toBe(false);
    expect(validateRelayBody(call('aztec_getNodeInfo', { params: 'x' })).ok).toBe(false);
    expect(validateRelayBody(call('aztec_getNodeInfo', { id: { a: 1 } })).ok).toBe(false);
    const big = JSON.stringify(Array.from({ length: RELAY_MAX_BATCH + 1 }, (_, id) => ({ jsonrpc: '2.0', id, method: 'aztec_getBlockNumber' })));
    expect(validateRelayBody(big).ok).toBe(false);
  });

  it('takes the upstream from server configuration only, never with credentials', () => {
    expect(relayUpstreams({ NEXT_PUBLIC_AZTEC_NETWORK: 'alpha' })).toEqual(['https://aztec-mainnet.drpc.org']);
    expect(relayUpstreams({ NEXT_PUBLIC_AZTEC_NETWORK: 'alpha', NEXT_PUBLIC_AZTEC_NODE_URL: 'https://node.example/' })).toEqual(['https://node.example']);
    expect(
      relayUpstreams({ AZTEC_NODE_RELAY_UPSTREAMS: 'https://a.example, ftp://b.example, https://u:p@c.example, http://aztec-node:8080, https://a.example' }),
    ).toEqual(['https://a.example', 'http://aztec-node:8080']);
  });

  it('passes back only the body type and the node\'s version headers', () => {
    const h = relayResponseHeaders(new Headers({ 'content-type': 'application/json', 'set-cookie': 'a=b', 'x-aztec-rollup-version': '6', server: 'x' }));
    expect(h.get('set-cookie')).toBeNull();
    expect(h.get('server')).toBeNull();
    expect(h.get('x-aztec-rollup-version')).toBe('6');
    expect(h.get('cache-control')).toBe('no-store');
  });

  it('the route forwards no client header, needs a session and has its own rate bucket', async () => {
    const { isPublicPath } = await import('@/middleware');
    expect(isPublicPath('/api/aztec/node')).toBe(false);
    const root = path.resolve(__dirname, '../../..');
    const route = fs.readFileSync(path.join(root, 'app/api/aztec/node/route.ts'), 'utf8');
    expect(route).toMatch(/headers: \{ 'content-type': 'application\/json', accept: 'application\/json' \}/);
    expect(route).toMatch(/redirect: 'error'/);
    expect(route).not.toMatch(/req\.headers\.get\('(cookie|authorization)'\)/);
    const mw = fs.readFileSync(path.join(root, 'middleware.ts'), 'utf8');
    expect(mw).toMatch(/const relay = pathname === '\/api\/aztec\/node';/);
  });
});
