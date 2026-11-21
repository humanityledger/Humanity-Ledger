// @ts-check
/**
 * The relay's test cases, written once with node:assert. They run standalone with
 * `npm test` in relay/ and in the repository's suite through test/unit/relay/relay.test.ts.
 * Keys and secrets here are generated for the test and thrown away.
 */
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, verify } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readConfig, capabilities } from '../src/config.mjs';
import { turnCredentials, verifyTurnCredential } from '../src/turn.mjs';
import { BlobStore, looksLikePlaintext } from '../src/blobs.mjs';
import { PeerHub } from '../src/signalling.mjs';
import { PushRegistry, isPushEndpoint, vapidAuthorization } from '../src/push.mjs';
import { createRelay, RateLimiter } from '../src/server.mjs';

const sha = (/** @type {Uint8Array} */ b) => createHash('sha256').update(b).digest('hex');
const tmp = () => mkdtempSync(path.join(tmpdir(), 'relay-test-'));
const blobOpts = (dir = tmp()) => ({ dir, maxBytes: 1024 * 1024, defaultTtlSeconds: 3600, maxTtlSeconds: 7200, quotaBytes: 4 * 1024 * 1024 });

/** A fake socket that records what it was sent. */
function sock() {
  /** @type {any[]} */
  const sent = [];
  return { sent, closed: /** @type {number | null} */ (null), send(/** @type {string} */ d) { sent.push(JSON.parse(d)); }, close(/** @type {number} */ c) { this.closed = c ?? 1000; } };
}

function vapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pub = /** @type {any} */ (publicKey.export({ format: 'jwk' }));
  const priv = /** @type {any} */ (privateKey.export({ format: 'jwk' }));
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);
  return { publicKey: raw.toString('base64url'), privateKey: priv.d, subject: 'https://relay.example', keyObject: publicKey };
}

/** @type {{ name: string; fn: () => Promise<void> | void }[]} */
export const CASES = [
  {
    name: 'config: a bare relay offers signalling only, and reads tokens as token access',
    fn() {
      const c = readConfig({});
      assert.deepEqual(capabilities(c), { turn: false, signalling: true, blobs: false, push: false });
      assert.equal(c.access, 'open');
      assert.equal(readConfig({ RELAY_ACCESS_TOKENS: 'a,b' }).access, 'token');
      assert.deepEqual(readConfig({ RELAY_ALLOWED_ORIGINS: 'https://a.example, https://b.example' }).allowedOrigins, ['https://a.example', 'https://b.example']);
    },
  },
  {
    name: 'turn: credentials expire, carry no identity and verify the way coturn checks them',
    fn() {
      const now = Date.UTC(2026, 10, 21);
      const c = turnCredentials({ secret: 's3cret', urls: ['turn:relay.example:3478'], ttlSeconds: 600 }, now);
      assert.ok(c);
      const { username, credential } = c.iceServers[0];
      assert.match(username, /^\d+:[A-Za-z0-9_-]+$/);
      assert.equal(Number(username.split(':')[0]), now / 1000 + 600);
      assert.ok(verifyTurnCredential('s3cret', username, credential, now));
      assert.ok(!verifyTurnCredential('other', username, credential, now));
      assert.ok(!verifyTurnCredential('s3cret', username, credential, now + 601_000));
      assert.equal(turnCredentials({ secret: '', urls: [], ttlSeconds: 600 }), null);
    },
  },
  {
    name: 'blobs: ciphertext round-trips by its hash; wrong hash and plaintext are refused',
    async fn() {
      const store = new BlobStore(blobOpts());
      const bytes = randomBytes(4096);
      const put = await store.put(sha(bytes), bytes);
      assert.equal(put.status, 201);
      assert.equal(typeof put.body.deleteToken, 'string');
      assert.deepEqual(Buffer.from(/** @type {Uint8Array} */ (await store.get(sha(bytes)))), bytes);
      assert.equal((await store.put(sha(bytes), bytes)).status, 200, 'same bytes twice is idempotent');
      const other = randomBytes(64);
      assert.equal((await store.put(sha(bytes), other)).status, 422);
      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), randomBytes(100)]);
      assert.equal((await store.put(sha(png), png)).status, 422);
      assert.ok(looksLikePlaintext(Buffer.from('{"hello": "this is a json document that is clearly not encrypted at all, plain text"}')));
      assert.ok(!looksLikePlaintext(randomBytes(2048)));
      assert.equal((await store.put('ABC', bytes)).status, 400);
    },
  },
  {
    name: 'blobs: expiry, delete tokens, size and quota',
    async fn() {
      let now = 1_000_000;
      const store = new BlobStore({ ...blobOpts(), quotaBytes: 6000 }, () => now);
      const a = randomBytes(4000);
      const put = await store.put(sha(a), a, 120);
      assert.equal(put.status, 201);
      const b = randomBytes(4000);
      assert.equal((await store.put(sha(b), b)).status, 507, 'quota');
      assert.equal(await store.delete(sha(a), 'wrong'), false);
      assert.equal(await store.delete(sha(a), String(put.body.deleteToken)), true);
      assert.equal(await store.get(sha(a)), null);
      const c = randomBytes(1000);
      await store.put(sha(c), c, 60);
      now += 61_000;
      assert.equal(await store.get(sha(c)), null, 'expired');
      assert.equal(await store.sweep(), 0, 'already removed on read');
      const big = randomBytes(2 * 1024 * 1024);
      assert.equal((await new BlobStore(blobOpts()).put(sha(big), big)).status, 413);
    },
  },
  {
    name: 'signalling: wrong key and missing id are refused; a taken id needs its token',
    fn() {
      const hub = new PeerHub({ key: 'peerjs', expireMs: 5000, aliveMs: 60000, maxClients: 10 });
      const s1 = sock();
      assert.equal(hub.connect(s1, { key: 'nope', id: 'a', token: 't' }), false);
      assert.deepEqual(s1.sent[0], { type: 'ERROR', payload: { msg: 'Invalid key provided' } });
      const s2 = sock();
      assert.equal(hub.connect(s2, { key: 'peerjs', id: '', token: 't' }), false);
      const a = sock();
      assert.equal(hub.connect(a, { key: 'peerjs', id: 'alice', token: 't1' }), true);
      assert.deepEqual(a.sent[0], { type: 'OPEN' });
      const thief = sock();
      assert.equal(hub.connect(thief, { key: 'peerjs', id: 'alice', token: 'other' }), false);
      assert.equal(thief.sent[0].type, 'ID-TAKEN');
      const again = sock();
      assert.equal(hub.connect(again, { key: 'peerjs', id: 'alice', token: 't1' }), true, 'reconnect with the same token');
      assert.equal(a.closed, 1000);
    },
  },
  {
    name: 'signalling: forwards with src set, queues for a peer not yet here, expires to the sender',
    fn() {
      let now = 0;
      const hub = new PeerHub({ key: 'peerjs', expireMs: 5000, aliveMs: 60000, maxClients: 10 }, () => now);
      const a = sock();
      const b = sock();
      hub.connect(a, { key: 'peerjs', id: 'alice', token: 't' });
      hub.connect(b, { key: 'peerjs', id: 'bob', token: 't' });
      assert.equal(hub.message('alice', JSON.stringify({ type: 'OFFER', dst: 'bob', src: 'forged', payload: { sdp: 'x' } })), true);
      assert.deepEqual(b.sent.at(-1), { type: 'OFFER', src: 'alice', dst: 'bob', payload: { sdp: 'x' } });
      assert.equal(hub.message('alice', JSON.stringify({ type: 'HEARTBEAT' })), true);
      assert.equal(hub.message('alice', JSON.stringify({ type: 'NOT-A-TYPE', dst: 'bob' })), false);
      hub.message('alice', JSON.stringify({ type: 'CANDIDATE', dst: 'carol', payload: {} }));
      const c = sock();
      now = 1000;
      hub.connect(c, { key: 'peerjs', id: 'carol', token: 't' });
      assert.deepEqual(c.sent.map((m) => m.type), ['OPEN', 'CANDIDATE'], 'queued message delivered on connect');
      hub.message('alice', JSON.stringify({ type: 'OFFER', dst: 'dave', payload: {} }));
      now = 7000;
      hub.tick();
      assert.deepEqual(a.sent.at(-1), { type: 'EXPIRE', src: 'dave', dst: 'alice' });
      now = 70_000;
      hub.tick();
      assert.equal(hub.stats().peers, 0, 'silent clients are dropped');
    },
  },
  {
    name: 'push: only browser push services; VAPID JWT verifies; wakes are coalesced; gone subscriptions are removed',
    async fn() {
      assert.ok(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'));
      assert.ok(isPushEndpoint('https://web.push.apple.com/QABC'));
      assert.ok(!isPushEndpoint('http://fcm.googleapis.com/x'));
      assert.ok(!isPushEndpoint('https://evil.example/fcm.googleapis.com'));
      assert.ok(!isPushEndpoint('https://169.254.169.254/latest'));
      const keys = vapidKeys();
      const auth = vapidAuthorization(keys, 'https://fcm.googleapis.com/fcm/send/abc', 1_000_000);
      const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(auth);
      assert.ok(m);
      const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
      assert.equal(claims.aud, 'https://fcm.googleapis.com');
      assert.ok(verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key: keys.keyObject, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url')));
      /** @type {any[]} */
      const calls = [];
      let status = 201;
      let now = 1_000_000;
      const reg = new PushRegistry({ ...keys, ttlDays: 30, file: '' }, /** @type {any} */ (async (url, init) => { calls.push({ url, init }); return { status }; }), () => now);
      assert.equal((await reg.register({ subscription: { endpoint: 'https://evil.example/x' } })).status, 400);
      const r = await reg.register({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc' } });
      assert.equal(r.status, 201);
      const token = String(r.body.token);
      assert.equal((await reg.wake(token)).status, 202);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].init.headers['Content-Length'], '0', 'no payload');
      assert.deepEqual((await reg.wake(token)).body, { coalesced: true });
      now += 3000;
      status = 410;
      assert.equal((await reg.wake(token)).status, 410);
      assert.equal((await reg.wake(token)).status, 404);
    },
  },
  {
    name: 'rate limiter: a burst is allowed, a flood is not, and it refills',
    fn() {
      let now = 0;
      const rl = new RateLimiter(60, () => now);
      for (let i = 0; i < 60; i++) assert.ok(rl.take('x'));
      assert.ok(!rl.take('x'));
      now = 2000;
      assert.ok(rl.take('x'));
    },
  },
  {
    name: 'server: health, info, TURN, CORS, blobs over HTTP, and token access',
    async fn() {
      const config = readConfig({
        RELAY_TURN_SECRET: 'test-secret',
        RELAY_TURN_URLS: 'turn:relay.example:3478?transport=udp',
        RELAY_BLOB_DIR: tmp(),
        RELAY_ALLOWED_ORIGINS: 'https://ledgerchat.org',
      });
      const relay = createRelay(config);
      await new Promise((r) => relay.server.listen(0, () => r(undefined)));
      const port = /** @type {any} */ (relay.server.address()).port;
      const base = `http://127.0.0.1:${port}`;
      try {
        assert.equal((await fetch(`${base}/health`)).status, 200);
        const info = await (await fetch(`${base}/v0/info`)).json();
        assert.equal(info.protocol, 'ledger-relay/0');
        assert.deepEqual(info.capabilities, { turn: true, signalling: true, blobs: true, push: false });
        assert.ok(info.never.includes('payments'));
        const turn = await fetch(`${base}/v0/turn`, { headers: { Origin: 'https://ledgerchat.org' } });
        assert.equal(turn.headers.get('access-control-allow-origin'), 'https://ledgerchat.org');
        assert.equal((await turn.json()).iceServers[0].urls[0], 'turn:relay.example:3478?transport=udp');
        const other = await fetch(`${base}/v0/info`, { headers: { Origin: 'https://evil.example' } });
        assert.equal(other.headers.get('access-control-allow-origin'), null);
        const bytes = randomBytes(2048);
        const put = await fetch(`${base}/v0/blobs/${sha(bytes)}`, { method: 'PUT', body: bytes });
        assert.equal(put.status, 201);
        const got = await fetch(`${base}/v0/blobs/${sha(bytes)}`);
        assert.equal(got.headers.get('content-type'), 'application/octet-stream');
        assert.equal(got.headers.get('x-content-type-options'), 'nosniff');
        assert.deepEqual(Buffer.from(await got.arrayBuffer()), bytes);
        assert.equal((await fetch(`${base}/v0/blobs/not-a-hash`)).status, 400);
        assert.equal((await fetch(`${base}/v0/push/register`, { method: 'POST', body: '{}' })).status, 404, 'push not configured');
        assert.equal((await fetch(`${base}/nope`)).status, 404);
        // PeerJS compatibility: an id on request, never the list of peers.
        const id = await fetch(`${base}/peerjs/peerjs/id`);
        assert.equal(id.status, 200);
        assert.match(await id.text(), /^[0-9a-f-]{36}$/);
        assert.equal((await fetch(`${base}/peerjs/peerjs/peers`)).status, 401);
      } finally {
        await relay.close();
      }
      const locked = createRelay(readConfig({ RELAY_TURN_SECRET: 's', RELAY_TURN_URLS: 'turn:x', RELAY_ACCESS_TOKENS: 'org-token' }));
      await new Promise((r) => locked.server.listen(0, () => r(undefined)));
      const lp = /** @type {any} */ (locked.server.address()).port;
      try {
        assert.equal((await fetch(`http://127.0.0.1:${lp}/v0/turn`)).status, 401);
        assert.equal((await fetch(`http://127.0.0.1:${lp}/v0/turn`, { headers: { Authorization: 'Bearer org-token' } })).status, 200);
      } finally {
        await locked.close();
      }
    },
  },
  {
    name: 'server: two PeerJS clients reach each other through the relay over WebSocket',
    async fn() {
      let WebSocket;
      try {
        ({ WebSocket } = await import('ws'));
      } catch {
        return; // signalling needs the ws package; the hub itself is tested above
      }
      const relay = createRelay(readConfig({}));
      assert.equal(await relay.attachSignalling(), true);
      await new Promise((r) => relay.server.listen(0, () => r(undefined)));
      const port = /** @type {any} */ (relay.server.address()).port;
      const open = (/** @type {string} */ id) => new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/peerjs/peerjs?key=peerjs&id=${id}&token=t${id}`);
        /** @type {any[]} */
        const inbox = [];
        ws.on('message', (d) => inbox.push(JSON.parse(String(d))));
        ws.on('error', reject);
        const t = setInterval(() => {
          if (inbox.some((m) => m.type === 'OPEN')) { clearInterval(t); resolve({ ws, inbox }); }
        }, 10);
        setTimeout(() => { clearInterval(t); reject(new Error(`no OPEN for ${id}`)); }, 3000);
      });
      try {
        const a = /** @type {any} */ (await open('alice-device'));
        const b = /** @type {any} */ (await open('bob-device'));
        a.ws.send(JSON.stringify({ type: 'OFFER', dst: 'bob-device', payload: { sdp: 'v=0' } }));
        const got = await new Promise((resolve, reject) => {
          const t = setInterval(() => {
            const m = b.inbox.find((x) => x.type === 'OFFER');
            if (m) { clearInterval(t); resolve(m); }
          }, 10);
          setTimeout(() => { clearInterval(t); reject(new Error('offer not delivered')); }, 3000);
        });
        assert.equal(/** @type {any} */ (got).src, 'alice-device');
        assert.deepEqual(/** @type {any} */ (got).payload, { sdp: 'v=0' });
        a.ws.close();
        b.ws.close();
      } finally {
        await relay.close();
      }
    },
  },
];
