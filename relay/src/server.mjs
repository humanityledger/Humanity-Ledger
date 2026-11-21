// @ts-check
/**
 * Ledger Relay, v0: one small HTTP and WebSocket service that anyone can run.
 *
 *   GET  /health                     liveness
 *   GET  /v0/info                    name, operator, protocol version, what this relay offers
 *   GET  /v0/turn                    short-lived TURN credentials
 *   PUT  /v0/blobs/:sha256           store ciphertext (body), expiring; returns a delete token
 *   GET  /v0/blobs/:sha256           read it back (HEAD too)
 *   DELETE /v0/blobs/:sha256         with X-Delete-Token
 *   POST /v0/push/register           a Web Push subscription in, an opaque token out
 *   POST /v0/push/wake               { token }: one empty push
 *   DELETE /v0/push/:token           forget a subscription
 *   GET  /peerjs/:key/id             PeerJS id, then WebSocket at /peerjs/peerjs (signalling)
 *   GET  /metrics                    counters only, with RELAY_METRICS_TOKEN
 *
 * It never sees plaintext, keys, wallet addresses or amounts, and it never carries payments.
 * Logs are counters: no addresses, hashes, ids or tokens are written anywhere. Client addresses
 * live in memory only, for the rate limiter's one-minute window.
 */
import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readConfig, capabilities } from './config.mjs';
import { turnCredentials } from './turn.mjs';
import { BlobStore, HASH_RE } from './blobs.mjs';
import { PushRegistry } from './push.mjs';
import { PeerHub } from './signalling.mjs';

export const PROTOCOL = 'ledger-relay/0';
export const VERSION = '0.2.0';

/** A token bucket per client address, in memory, forgotten after a minute of silence. */
export class RateLimiter {
  constructor(perMinute = 120, clock = Date.now) {
    this.perMinute = perMinute;
    this.clock = clock;
    /** @type {Map<string, { tokens: number; at: number }>} */
    this.buckets = new Map();
  }
  take(/** @type {string} */ key, cost = 1) {
    const now = this.clock();
    const b = this.buckets.get(key) ?? { tokens: this.perMinute, at: now };
    b.tokens = Math.min(this.perMinute, b.tokens + ((now - b.at) / 60000) * this.perMinute);
    b.at = now;
    const ok = b.tokens >= cost;
    if (ok) b.tokens -= cost;
    this.buckets.set(key, b);
    return ok;
  }
  sweep() {
    const now = this.clock();
    for (const [k, b] of this.buckets) if (now - b.at > 60000) this.buckets.delete(k);
  }
}

const same = (/** @type {string} */ a, /** @type {string} */ b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * @param {import('./config.mjs').RelayConfig} config
 * @param {{ fetchImpl?: typeof fetch; clock?: () => number }} [deps]
 */
export function createRelay(config, deps = {}) {
  const caps = capabilities(config);
  const blobs = caps.blobs ? new BlobStore(config.blobs, deps.clock) : null;
  const push = caps.push ? new PushRegistry(config.push, deps.fetchImpl, deps.clock) : null;
  const hub = caps.signalling ? new PeerHub(config.signalling, deps.clock) : null;
  const limiter = new RateLimiter(240, deps.clock);
  /** @type {Record<string, number>} */
  const counters = {};
  const count = (/** @type {string} */ k) => { counters[k] = (counters[k] ?? 0) + 1; };

  const clientKey = (/** @type {http.IncomingMessage} */ req) => {
    if (config.trustProxy) {
      const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
      if (fwd) return fwd;
    }
    return req.socket.remoteAddress ?? 'unknown';
  };

  const authorised = (/** @type {http.IncomingMessage} */ req) => {
    if (config.access === 'open') return true;
    const m = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''));
    return Boolean(m && config.accessTokens.some((t) => same(t, m[1])));
  };

  /** @param {http.ServerResponse} res @param {number} status @param {unknown} body */
  const json = (res, status, body) => {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' });
    res.end(data);
  };

  /** @param {http.IncomingMessage} req @param {number} max */
  const readBody = (req, max) =>
    new Promise((resolve, reject) => {
      const declared = Number(req.headers['content-length'] ?? 0);
      if (declared > max) return reject(Object.assign(new Error('too large'), { status: 413 }));
      /** @type {Buffer[]} */
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > max) {
          req.destroy();
          reject(Object.assign(new Error('too large'), { status: 413 }));
        } else chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

  const readJson = async (/** @type {http.IncomingMessage} */ req) => {
    const b = /** @type {Buffer} */ (await readBody(req, 16 * 1024));
    try {
      return JSON.parse(b.toString('utf8') || '{}');
    } catch {
      return null;
    }
  };

  /** @param {http.IncomingMessage} req @param {http.ServerResponse} res */
  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://relay');
    const origin = String(req.headers.origin ?? '');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Vary', 'Origin');
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Relay-TTL, X-Delete-Token');
      res.setHeader('Access-Control-Expose-Headers', 'X-Relay-Expires');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const p = url.pathname;
    if (p === '/health') return json(res, 200, { ok: true });
    if (!limiter.take(clientKey(req))) { count('rate_limited'); return json(res, 429, { error: 'Too many requests. Slow down.' }); }

    if (p === '/v0/info' && req.method === 'GET') {
      count('info');
      return json(res, 200, {
        name: config.name,
        operator: config.operator || null,
        protocol: PROTOCOL,
        version: VERSION,
        access: config.access,
        capabilities: caps,
        limits: { blobMaxBytes: config.blobs.maxBytes, blobTtlSeconds: config.blobs.defaultTtlSeconds, blobMaxTtlSeconds: config.blobs.maxTtlSeconds },
        signalling: caps.signalling ? { path: '/peerjs/', key: config.signalling.key } : null,
        pushPublicKey: caps.push ? config.push.publicKey : null,
        never: ['plaintext', 'keys', 'wallet addresses', 'amounts', 'payments'],
      });
    }

    // PeerJS clients ask the server for an id when they have none, and may list peers. Ledger Chat
    // uses ids derived on the device, but any PeerJS client can connect, so both are answered: an
    // id is a random UUID, and the peer list is never disclosed.
    if (caps.signalling && req.method === 'GET' && /^\/peerjs\/[^/]+\/id$|^\/peerjs\/id$/.test(p)) {
      count('peer_id');
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(randomUUID());
    }
    if (caps.signalling && req.method === 'GET' && /^\/peerjs\/[^/]+\/peers$|^\/peerjs\/peers$/.test(p)) {
      return json(res, 401, { error: 'This relay does not list its peers.' });
    }

    if (p === '/v0/turn' && req.method === 'GET') {
      if (!caps.turn) return json(res, 404, { error: 'This relay offers no TURN service.' });
      if (!authorised(req)) return json(res, 401, { error: 'This relay needs an access token.' });
      count('turn');
      return json(res, 200, turnCredentials(config.turn, deps.clock?.()));
    }

    const blob = /^\/v0\/blobs\/([^/]+)$/.exec(p);
    if (blob) {
      if (!blobs) return json(res, 404, { error: 'This relay stores no files.' });
      const hash = blob[1];
      if (!HASH_RE.test(hash)) return json(res, 400, { error: 'The address must be a lowercase hex SHA-256.' });
      if (req.method === 'PUT') {
        if (!authorised(req)) return json(res, 401, { error: 'This relay needs an access token.' });
        if (!limiter.take(`${clientKey(req)}:put`, 4)) return json(res, 429, { error: 'Too many uploads. Slow down.' });
        const body = /** @type {Buffer} */ (await readBody(req, config.blobs.maxBytes));
        const r = await blobs.put(hash, body, Number(req.headers['x-relay-ttl']));
        count(`blob_put_${r.status}`);
        return json(res, r.status, r.body);
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        const bytes = await blobs.get(hash);
        count(bytes ? 'blob_get' : 'blob_miss');
        if (!bytes) return json(res, 404, { error: 'Not found or expired.' });
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': bytes.length,
          'Content-Disposition': 'attachment',
          'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'none'; sandbox",
        });
        return res.end(req.method === 'HEAD' ? undefined : bytes);
      }
      if (req.method === 'DELETE') {
        const ok = await blobs.delete(hash, String(req.headers['x-delete-token'] ?? ''));
        count(ok ? 'blob_delete' : 'blob_delete_refused');
        return ok ? (res.writeHead(204), res.end()) : json(res, 403, { error: 'Wrong or missing delete token.' });
      }
      return json(res, 405, { error: 'Method not allowed.' });
    }

    if (p.startsWith('/v0/push/')) {
      if (!push) return json(res, 404, { error: 'This relay sends no notifications.' });
      if (p === '/v0/push/register' && req.method === 'POST') {
        if (!authorised(req)) return json(res, 401, { error: 'This relay needs an access token.' });
        const r = await push.register(await readJson(req));
        count(`push_register_${r.status}`);
        return json(res, r.status, r.body);
      }
      if (p === '/v0/push/wake' && req.method === 'POST') {
        const body = await readJson(req);
        if (!limiter.take(`${clientKey(req)}:wake`, 2)) return json(res, 429, { error: 'Too many wake-ups. Slow down.' });
        const r = await push.wake(String(body?.token ?? ''));
        count(`push_wake_${r.status}`);
        return json(res, r.status, r.body);
      }
      const del = /^\/v0\/push\/([A-Za-z0-9_-]{16,64})$/.exec(p);
      if (del && req.method === 'DELETE') {
        await push.unregister(del[1]);
        count('push_unregister');
        res.writeHead(204);
        return res.end();
      }
      return json(res, 404, { error: 'Not found.' });
    }

    const peerId = /^\/peerjs\/([^/]+)\/id$/.exec(p);
    if (peerId && hub && req.method === 'GET') {
      if (peerId[1] !== config.signalling.key) return json(res, 401, { error: 'Invalid key provided' });
      count('peer_id');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(hub.newId());
    }

    if (p === '/metrics' && config.metricsToken) {
      const m = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''));
      if (!m || !same(m[1], config.metricsToken)) return json(res, 401, { error: 'Unauthorised.' });
      const lines = Object.entries(counters).map(([k, v]) => `ledger_relay_requests_total{kind="${k}"} ${v}`);
      if (hub) lines.push(`ledger_relay_peers ${hub.stats().peers}`, `ledger_relay_peer_queue ${hub.stats().waiting}`);
      if (blobs) lines.push(`ledger_relay_blob_bytes ${blobs.used}`);
      if (push) lines.push(`ledger_relay_push_subscriptions ${push.subs.size}`);
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4', 'Cache-Control': 'no-store' });
      return res.end(`${lines.join('\n')}\n`);
    }

    return json(res, 404, { error: 'Not found.' });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      count('error');
      if (!res.headersSent) json(res, Number(err?.status) || 500, { error: Number(err?.status) === 413 ? 'Too large.' : 'Something went wrong.' });
      else res.destroy();
    });
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 15_000;

  /** @type {NodeJS.Timeout[]} */
  const timers = [];
  if (hub) timers.push(setInterval(() => hub.tick(), 1000));
  timers.push(setInterval(() => limiter.sweep(), 60_000));
  if (blobs) timers.push(setInterval(() => void blobs.sweep().catch(() => {}), 10 * 60_000));
  if (push) timers.push(setInterval(() => void push.sweep().catch(() => {}), 60 * 60_000));
  for (const t of timers) t.unref();

  /** @type {any} */
  let sockets = null;

  /** Attaches PeerJS-compatible signalling. `ws` is the relay's one dependency. */
  async function attachSignalling() {
    if (!hub) return false;
    let WebSocketServer;
    try {
      ({ WebSocketServer } = await import('ws'));
    } catch {
      console.warn('[relay] signalling is off: install the "ws" package (npm install in relay/).');
      return false;
    }
    const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
    sockets = wss;
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://relay');
      if (url.pathname !== '/peerjs/peerjs') return socket.destroy();
      const origin = String(req.headers.origin ?? '');
      if (origin && !config.allowedOrigins.includes(origin)) return socket.destroy();
      if (!limiter.take(`${clientKey(req)}:ws`, 2)) return socket.destroy();
      wss.handleUpgrade(req, socket, head, (ws) => {
        const id = url.searchParams.get('id') ?? '';
        const ok = hub.connect(ws, { key: url.searchParams.get('key'), id, token: url.searchParams.get('token') });
        count(ok ? 'peer_open' : 'peer_refused');
        if (!ok) return;
        ws.on('message', (data) => hub.message(id, data.toString()));
        ws.on('close', () => hub.disconnect(id, ws));
        ws.on('error', () => hub.disconnect(id, ws));
      });
    });
    return true;
  }

  /** Stops timers, ends every WebSocket (upgraded sockets are not tracked by the HTTP server) and closes. */
  function close() {
    for (const t of timers) clearInterval(t);
    if (sockets) {
      for (const ws of sockets.clients) { try { ws.terminate(); } catch { /* already gone */ } }
      try { sockets.close(); } catch { /* already closed */ }
    }
    return new Promise((resolve) => {
      server.close(() => resolve(undefined));
      /** @type {any} */ (server).closeAllConnections?.();
    });
  }

  return { server, attachSignalling, close, hub, blobs, push, caps, counters };
}

/* Run directly: node src/server.mjs */
if (process.argv[1]?.endsWith('server.mjs') && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = readConfig();
  const relay = createRelay(config);
  await relay.attachSignalling();
  relay.server.listen(config.port, () => {
    const on = Object.entries(relay.caps).filter(([, v]) => v).map(([k]) => k);
    console.log(`[relay] ${config.name} ${VERSION} listening on :${config.port}; offers ${on.join(', ') || 'nothing yet'}; access ${config.access}`);
  });
  const stop = () => void relay.close().then(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
