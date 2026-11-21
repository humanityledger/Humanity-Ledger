// @ts-check
/**
 * The push relay: opaque wake-ups, without senders or content.
 *
 * A device registers its Web Push subscription and receives an opaque token. It shares that token
 * only inside MLS messages with the people allowed to wake it. A wake request carries the token and
 * nothing else; the relay sends an empty push (no payload, so nothing to read even for the push
 * service), and the device's service worker fetches new messages itself over XMTP.
 *
 * The relay therefore sees: a push endpoint, an opaque token, and the time of each wake. It never
 * sees who sent a message, to whom in the conversation, or what it said.
 */
import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import { promises as fs } from 'node:fs';

/** Push services browsers use. An endpoint elsewhere is refused, so the relay cannot be used to call arbitrary hosts. */
const PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
  'notify.windows.com',
];

export function isPushEndpoint(/** @type {string} */ endpoint) {
  let u;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
  return PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
}

const b64u = (/** @type {Buffer | string} */ x) => Buffer.from(x).toString('base64url');

/**
 * A VAPID JWT (RFC 8292) signed with ES256.
 * @param {{ publicKey: string; privateKey: string; subject: string }} vapid base64url keys: the
 *   uncompressed P-256 public point (65 bytes) and the private scalar (32 bytes)
 */
export function vapidAuthorization(vapid, endpoint, now = Date.now()) {
  const pub = Buffer.from(vapid.publicKey, 'base64url');
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('RELAY_VAPID_PUBLIC_KEY must be an uncompressed P-256 point');
  const key = createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: vapid.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: 'jwk',
  });
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject }));
  const input = `${header}.${claims}`;
  const sig = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${input}.${b64u(sig)}, k=${vapid.publicKey}`;
}

export class PushRegistry {
  /**
   * @param {{ publicKey: string; privateKey: string; subject: string; ttlDays: number; file: string }} opts
   * @param {typeof fetch} [fetchImpl]
   * @param {() => number} [clock]
   */
  constructor(opts, fetchImpl = fetch, clock = Date.now) {
    this.opts = opts;
    this.fetch = fetchImpl;
    this.clock = clock;
    /** @type {Map<string, { endpoint: string; expiresAt: number; lastWake: number }>} */
    this.subs = new Map();
    this.ready = this.load();
  }

  async load() {
    if (!this.opts.file) return;
    try {
      const saved = JSON.parse(await fs.readFile(this.opts.file, 'utf8'));
      for (const [token, s] of Object.entries(saved)) if (s && typeof s.endpoint === 'string') this.subs.set(token, { ...s, lastWake: 0 });
    } catch {
      /* first start */
    }
  }

  async save() {
    if (!this.opts.file) return;
    const out = Object.fromEntries([...this.subs].map(([t, s]) => [t, { endpoint: s.endpoint, expiresAt: s.expiresAt }]));
    await fs.writeFile(this.opts.file, JSON.stringify(out), { mode: 0o600 });
  }

  /** @returns {Promise<{ status: number; body: Record<string, unknown> }>} */
  async register(/** @type {unknown} */ input) {
    await this.ready;
    const endpoint = /** @type {any} */ (input)?.subscription?.endpoint ?? /** @type {any} */ (input)?.endpoint;
    if (typeof endpoint !== 'string' || !isPushEndpoint(endpoint)) return { status: 400, body: { error: 'A Web Push endpoint of a browser push service is required.' } };
    const token = randomBytes(24).toString('base64url');
    const expiresAt = this.clock() + this.opts.ttlDays * 86400_000;
    this.subs.set(token, { endpoint, expiresAt, lastWake: 0 });
    await this.save();
    return { status: 201, body: { token, expiresAt: new Date(expiresAt).toISOString(), publicKey: this.opts.publicKey } };
  }

  async unregister(/** @type {string} */ token) {
    await this.ready;
    const had = this.subs.delete(token);
    if (had) await this.save();
    return had;
  }

  /**
   * Sends one empty push. At most one wake per token every two seconds: a burst of messages
   * becomes one wake-up, and the relay cannot be used to drain a phone's battery.
   * @returns {Promise<{ status: number; body: Record<string, unknown> }>}
   */
  async wake(/** @type {string} */ token) {
    await this.ready;
    const sub = typeof token === 'string' ? this.subs.get(token) : undefined;
    const now = this.clock();
    if (!sub || sub.expiresAt <= now) {
      if (sub) this.subs.delete(token);
      return { status: 404, body: { error: 'Unknown token.' } };
    }
    if (now - sub.lastWake < 2000) return { status: 202, body: { coalesced: true } };
    sub.lastWake = now;
    const res = await this.fetch(sub.endpoint, {
      method: 'POST',
      headers: { Authorization: vapidAuthorization(this.opts, sub.endpoint, now), TTL: '60', Urgency: 'high', 'Content-Length': '0' },
    }).catch(() => null);
    if (res && (res.status === 404 || res.status === 410)) {
      this.subs.delete(token);
      await this.save();
      return { status: 410, body: { error: 'The subscription has expired. Register again.' } };
    }
    return { status: 202, body: {} };
  }

  async sweep() {
    await this.ready;
    const now = this.clock();
    let n = 0;
    for (const [t, s] of this.subs) if (s.expiresAt <= now) { this.subs.delete(t); n++; }
    if (n) await this.save();
    return n;
  }
}
