/**
 * Linking a computer by QR, end to end, through the real route handlers and the real client
 * code of both devices (WhatsApp Web / Signal Desktop model):
 *
 *   computer: qr-init → shows the QR      phone: preview → "Link this computer" → qr-mobile-link
 *   computer: qr-poll → decrypts → qr-hydrate (session + channel key)
 *   computer: remoteSign (XMTP)          phone: pending → decrypt → sign → answer
 *   phone: list devices → unlink          computer: signed out
 *
 * Only Redis, the rate limiter and the wallet signature are faked. Each device has its own
 * cookie jar; `fetch` is routed to the handlers.
 */
import { vi } from 'vitest';
import { NextRequest } from 'next/server';

const mem = vi.hoisted(() => new Map<string, string>());
vi.mock('@/lib/redis/client', () => {
  const r = {
    __isMock: true,
    get: async (k: string) => mem.get(k) ?? null,
    set: async (k: string, v: string) => { mem.set(k, String(v)); return 'OK'; },
    setex: async (k: string, _t: number, v: string) => { mem.set(k, String(v)); return 'OK'; },
    del: async (k: string) => (mem.delete(k) ? 1 : 0),
  };
  return {
    redisClient: r,
    getRedisClient: async () => r,
    safeRedisGet: async (k: string) => mem.get(k) ?? null,
    safeRedisSet: async (k: string, v: string) => { mem.set(k, String(v)); return 'OK'; },
  };
});
vi.mock('@/lib/security/rateLimiter', () => ({
  getClientIP: () => '203.0.113.7',
  checkRateLimit: async () => ({ allowed: true, remaining: 10, resetAt: Math.floor(Date.now() / 1000) + 60 }),
}));

import { mintJWT } from '@/lib/jwt';
import * as qrInit from '@/app/api/auth/qr-init/route';
import * as qrMobileLink from '@/app/api/auth/qr-mobile-link/route';
import * as qrPoll from '@/app/api/auth/qr-poll/route';
import * as qrHydrate from '@/app/api/auth/qr-hydrate/route';
import * as link from '@/app/api/auth/link/route';
import { completeSessionHandshake, previewLink } from '@/lib/scan/sessionHandshake';
import { getPeers, getSelfLink, open as openSealed, remoteSign, seal, setSelfLink } from '@/lib/link/channel';

const W = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

type Jar = Map<string, string>;
const jars: Record<'phone' | 'computer', Jar> = { phone: new Map(), computer: new Map() };
let device: 'phone' | 'computer' = 'phone';

const ROUTES: Record<string, any> = {
  '/api/auth/qr-init': qrInit,
  '/api/auth/qr-mobile-link': qrMobileLink,
  '/api/auth/qr-poll': qrPoll,
  '/api/auth/qr-hydrate': qrHydrate,
  '/api/auth/link': link,
};

async function routedFetch(input: string, init: any = {}): Promise<Response> {
  const url = new URL(input, 'http://localhost:3000');
  const jar = jars[device];
  // What completeSessionHandshake asks about the phone's own session.
  if (url.pathname === '/api/auth/export-jwt') return Response.json({ authenticated: true, address: W });
  if (url.pathname === '/api/auth/verify-session') return Response.json({ authenticated: true, user: { address: W } });
  const mod = ROUTES[url.pathname];
  if (!mod) throw new Error(`unrouted ${url.pathname}`);
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});
  headers.set('user-agent', device === 'computer' ? MAC_CHROME : 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1');
  if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
  const req = new NextRequest(url, { method, headers, body: method === 'GET' ? undefined : init.body });
  const res: Response = await mod[method](req);
  for (const c of (res.headers as any).getSetCookie?.() ?? []) {
    const [pair, ...attrs] = String(c).split(';');
    const i = pair.indexOf('=');
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    const expired = attrs.some(a => /max-age=0\b/i.test(a.trim())) || value === '';
    if (expired) jar.delete(name); else jar.set(name, value);
  }
  return res;
}

const storage = new Map<string, string>();
beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-chars-ok-qr-link';
  (globalThis as any).localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, String(v)),
    removeItem: (k: string) => storage.delete(k),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() { return storage.size; },
  };
  vi.stubGlobal('fetch', vi.fn(routedFetch));
});
afterAll(() => vi.unstubAllGlobals());

async function signedInPhone() {
  jars.phone.set('hl_session', await mintJWT({ sub: W, address: W }));
}

/** The computer: what ConnectPage does. Returns the QR URL and how to finish. */
async function computerShowsQr() {
  device = 'computer';
  const { generateX25519KeyPair, generateVisualPin } = await import('@/lib/web-crypto');
  const pair = await generateX25519KeyPair();
  const pin = generateVisualPin();
  const uuid = crypto.randomUUID();
  const r = await fetch('/api/auth/qr-init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uuid, pub: pair.publicKey, ecdh: pair.isECDH, exp: Date.now() + 240_000 }) });
  expect(r.status).toBe(200);
  const qr = new URL('/connect', 'https://ledgerchat.org');
  qr.searchParams.set('s', uuid); qr.searchParams.set('p', pair.publicKey); qr.searchParams.set('ecdh', '1'); qr.searchParams.set('pin', pin);
  return {
    url: qr.toString(),
    async finish() {
      device = 'computer';
      const poll = await (await fetch(`/api/auth/qr-poll?uuid=${uuid}`)).json();
      expect(poll.encryptedPayload).toBeTruthy();
      expect(JSON.stringify(poll)).not.toMatch(/eyJ/); // no session token in what the computer polls
      const { deriveSharedSecret, decryptAESGCM } = await import('@/lib/web-crypto');
      const shared = await deriveSharedSecret(pair.privateKey, poll.mobilePub, pair.isECDH, pin);
      const p = JSON.parse(await decryptAESGCM(shared, poll.encryptedPayload, poll.iv));
      const hy = await fetch('/api/auth/qr-hydrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uuid, claim: p.claim }) });
      expect(hy.status).toBe(200);
      const hd = await hy.json();
      expect(hd).toMatchObject({ address: W, deviceId: p.deviceId });
      setSelfLink({ deviceId: p.deviceId, key: p.channelKey, wallet: p.wallet });
      return p as { deviceId: string; channelKey: string };
    },
  };
}

/** Until the computer's signing request is on the server (it is sent asynchronously). */
async function requestQueued() {
  for (let i = 0; i < 200; i++) {
    if ([...mem.keys()].some(k => k.startsWith('lreqs:'))) return;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error('the computer never sent its request');
}

beforeEach(() => { mem.clear(); storage.clear(); jars.phone.clear(); jars.computer.clear(); });

describe('linking a computer by QR', () => {
  it('links, relays a signature end to end, lists and unlinks', async () => {
    await signedInPhone();
    const qr = await computerShowsQr();

    // Phone: what is asking, before anything is linked.
    device = 'phone';
    const preview = await previewLink(qr.url);
    expect(preview).toMatchObject({ ok: true, label: 'Chrome on macOS' });
    const linked = await completeSessionHandshake(qr.url, () => W);
    expect(linked.ok).toBe(true);

    const p = await qr.finish();
    expect(jars.computer.get('hl_session')).toBeTruthy();
    expect(getPeers()[p.deviceId]?.key).toBe(p.channelKey); // the phone keeps the same channel key
    expect(getSelfLink(W)?.deviceId).toBe(p.deviceId);

    // The computer asks the phone to sign its XMTP registration; the phone approves.
    device = 'computer';
    const signing = remoteSign({ kind: 'xmtp', message: 'XMTP : Authenticate to inbox' }, { wallet: W, timeoutMs: 20_000 });
    await requestQueued();
    device = 'phone';
    const pending = await (await fetch('/api/auth/link?pending=1')).json();
    expect(pending.requests).toHaveLength(1);
    const req = pending.requests[0];
    expect(req.deviceLabel).toBe('Chrome on macOS');
    const peer = getPeers()[req.deviceId];
    const payload = await openSealed<any>(peer.key, `req|${req.deviceId}|${req.kind}`, req.ciphertext, req.iv);
    expect(payload).toEqual({ kind: 'xmtp', message: 'XMTP : Authenticate to inbox' });
    const sealed = await seal(peer.key, `ans|${req.id}|${req.kind}`, { signature: '0xdeadbeef' });
    expect((await fetch('/api/auth/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'answer', id: req.id, ...sealed }) })).status).toBe(200);
    device = 'computer';
    await expect(signing).resolves.toBe('0xdeadbeef');
    // The server only ever held ciphertext.
    expect([...mem.values()].join(' ')).not.toContain('Authenticate to inbox');

    // Phone: linked devices, then unlink: the computer is signed out at once.
    device = 'phone';
    const list = await (await fetch('/api/auth/link?devices=1')).json();
    expect(list).toMatchObject({ primary: true, devices: [{ id: p.deviceId, label: 'Chrome on macOS', current: false }] });
    expect((await fetch('/api/auth/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke', id: p.deviceId }) })).status).toBe(200);
    device = 'computer';
    expect((await fetch('/api/auth/link?devices=1')).status).toBe(401);
  }, 30_000);

  it('a declined request reaches the computer as a decline', async () => {
    await signedInPhone();
    const qr = await computerShowsQr();
    device = 'phone';
    expect((await completeSessionHandshake(qr.url, () => W)).ok).toBe(true);
    await qr.finish();
    device = 'computer';
    const signing = remoteSign({ kind: 'aztec', typedData: { domain: {}, types: {}, primaryType: 'X', message: {} } }, { wallet: W, timeoutMs: 20_000 });
    await requestQueued();
    device = 'phone';
    const { requests } = await (await fetch('/api/auth/link?pending=1')).json();
    await fetch('/api/auth/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decline', id: requests[0].id }) });
    device = 'computer';
    await expect(signing).rejects.toMatchObject({ code: 'DECLINED' });
  }, 30_000);

  it('refuses a forged system_handshake cookie (the session forgery fixed on 11 Nov)', async () => {
    const qr = await computerShowsQr();
    device = 'phone';
    jars.phone.set('system_handshake', W); // no real session
    const res = await completeSessionHandshake(qr.url, () => W);
    expect(res.ok).toBe(false);
    expect(mem.has(`qr-claim:${new URL(qr.url).searchParams.get('s')}`)).toBe(false);
  });

  it('a linked computer cannot link further computers or answer for the phone', async () => {
    await signedInPhone();
    const qr = await computerShowsQr();
    device = 'phone';
    await completeSessionHandshake(qr.url, () => W);
    await qr.finish();
    const second = await computerShowsQr();
    // The linked computer tries to approve a second code with its own session.
    device = 'computer';
    const uuid = new URL(second.url).searchParams.get('s')!;
    expect((await fetch(`/api/auth/link?uuid=${uuid}`)).status).toBe(403);
    expect((await fetch('/api/auth/link?pending=1')).status).toBe(403);
  });

  it('an expired or unknown code is refused with a clear message', async () => {
    await signedInPhone();
    device = 'phone';
    const r = await previewLink('https://ledgerchat.org/connect?s=11111111-2222-3333-4444-555555555555&p=abcdefghijklmnopqrstuvwx,yz');
    expect(r).toMatchObject({ ok: false });
    expect((r as any).message).toMatch(/expired/i);
  });
});
