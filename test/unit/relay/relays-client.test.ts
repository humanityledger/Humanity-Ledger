/**
 * The client side of Ledger Relay (lib/relay): which relays may be used, in which order, and how
 * a signed list is checked. The key pair here is generated for the test and thrown away.
 */
import { describe, expect, it } from 'vitest';
import {
  canonicalJson, candidateRelays, healthyRelays, normaliseRelayUrl, organisationRelays, relayEnabled,
  relayListKey, saveUserRelays, userRelays, verifyRelayList,
} from '@/lib/relay/relays';
import { downloadCiphertext, relayTurn, uploadCiphertext } from '@/lib/relay/client';

const b64u = (b: ArrayBuffer) => Buffer.from(new Uint8Array(b)).toString('base64url');

describe('relay list', () => {
  it('is off unless the flag says 1', () => {
    expect(relayEnabled({})).toBe(false);
    expect(relayEnabled({ NEXT_PUBLIC_LEDGER_RELAY: 'true' })).toBe(false);
    expect(relayEnabled({ NEXT_PUBLIC_LEDGER_RELAY: '1' })).toBe(true);
  });

  it('accepts https origins only, without credentials, paths or local hosts', () => {
    expect(normaliseRelayUrl('https://relay.example.org')).toBe('https://relay.example.org');
    expect(normaliseRelayUrl('https://relay.example.org/')).toBe('https://relay.example.org');
    for (const bad of ['http://relay.example.org', 'https://u:p@relay.example.org', 'https://relay.example.org/x', 'https://localhost', 'javascript:alert(1)', 'https://relay.example.org?x=1']) {
      expect(normaliseRelayUrl(bad), bad).toBeNull();
    }
  });

  it('orders organisation, signed, then user relays, without duplicates; pinning keeps the organisation only', () => {
    const organisation = organisationRelays({ NEXT_PUBLIC_LEDGER_RELAYS: 'https://a.example, https://b.example, http://bad.example, https://a.example' });
    expect(organisation.map((r) => r.url)).toEqual(['https://a.example', 'https://b.example']);
    const user = [{ url: 'https://c.example', source: 'user' as const }, { url: 'https://a.example', source: 'user' as const }];
    expect(candidateRelays({ organisation, user, pinned: false }).map((r) => r.url)).toEqual(['https://a.example', 'https://b.example', 'https://c.example']);
    expect(candidateRelays({ organisation, user, pinned: true }).map((r) => r.url)).toEqual(['https://a.example', 'https://b.example']);
  });

  it('keeps user relays on the device, and survives broken storage', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(saveUserRelays(['https://c.example', 'http://x.example'], storage)).toEqual(['https://c.example']);
    expect(userRelays(storage).map((r) => r.url)).toEqual(['https://c.example']);
    expect(userRelays({ getItem: () => { throw new Error('denied'); } })).toEqual([]);
  });

  it('verifies a signed list, and refuses a tampered, expired or unsigned one', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    const payload = { expires: '2027-01-01T00:00:00Z', relays: ['https://r1.example', 'https://r2.example'] };
    const signature = b64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(canonicalJson(payload))));
    const now = Date.parse('2026-11-21T00:00:00Z');
    expect((await verifyRelayList({ ...payload, signature }, jwk, now))?.map((r) => r.url)).toEqual(payload.relays);
    expect(await verifyRelayList({ ...payload, relays: ['https://evil.example'], signature }, jwk, now)).toBeNull();
    expect(await verifyRelayList({ ...payload, signature }, jwk, Date.parse('2027-02-01T00:00:00Z'))).toBeNull();
    expect(await verifyRelayList({ ...payload, signature }, null, now)).toBeNull();
    expect(relayListKey(undefined)).toBeNull();
    expect(relayListKey(JSON.stringify({ ...jwk, d: 'secret' }))).toBeNull();
  });

  it('canonical JSON sorts keys at every level', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { f: 1, e: 0 }], c: 'x' } })).toBe('{"a":{"c":"x","d":[2,{"e":0,"f":1}]},"b":1}');
  });
});

describe('relay client', () => {
  const info = (caps: Partial<Record<'turn' | 'signalling' | 'blobs' | 'push', boolean>>) =>
    new Response(JSON.stringify({ protocol: 'ledger-relay/0', capabilities: { turn: false, signalling: false, blobs: false, push: false, ...caps } }));

  it('keeps healthy relays that offer the capability, and skips the rest', async () => {
    const f = (async (url: string) => {
      if (url.startsWith('https://down.example')) throw new Error('offline');
      if (url.startsWith('https://noturn.example')) return info({ blobs: true });
      return info({ turn: true });
    }) as unknown as typeof fetch;
    const got = await healthyRelays(
      [{ url: 'https://down.example', source: 'organisation' }, { url: 'https://noturn.example', source: 'organisation' }, { url: 'https://ok.example', source: 'user' }],
      'turn',
      f,
    );
    expect(got.map((r) => r.url)).toEqual(['https://ok.example']);
  });

  it('reads TURN credentials and refuses an answer without them', async () => {
    const ok = (async () => new Response(JSON.stringify({ iceServers: [{ urls: ['turn:x'], username: 'u', credential: 'c' }], ttl: 600 }))) as unknown as typeof fetch;
    expect((await relayTurn({ url: 'https://r.example', source: 'user' }, ok))?.ttl).toBe(600);
    const empty = (async () => new Response(JSON.stringify({ iceServers: [{ urls: ['turn:x'] }] }))) as unknown as typeof fetch;
    expect(await relayTurn({ url: 'https://r.example', source: 'user' }, empty)).toBeNull();
  });

  it('addresses uploads by the hash of the ciphertext and checks downloads against it', async () => {
    const bytes = crypto.getRandomValues(new Uint8Array(256));
    let stored: Uint8Array | null = null;
    let putUrl = '';
    const f = (async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        putUrl = url;
        stored = new Uint8Array(init.body as Uint8Array);
        return new Response(JSON.stringify({ expiresAt: '2026-11-22T00:00:00Z', deleteToken: 't' }), { status: 201 });
      }
      return new Response(stored);
    }) as unknown as typeof fetch;
    const up = await uploadCiphertext({ url: 'https://r.example', source: 'user' }, bytes, { fetchImpl: f });
    expect(putUrl).toBe(`https://r.example/v0/blobs/${up.hash}`);
    expect(up.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await downloadCiphertext(up.url, up.hash, f)).toEqual(bytes);
    await expect(downloadCiphertext(up.url, '0'.repeat(64), f)).rejects.toThrow(/does not match/);
  });
});
