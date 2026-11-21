/**
 * Profile photos of the people you chat with (lib/chat/peerProfiles.ts): one batched request,
 * no clearing on errors, refreshed when stale.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { __resetPeerProfiles, getPeerProfile, requestPeerProfile, setPeerProfile, subscribePeerProfile } from '@/lib/chat/peerProfiles';

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}

const A = '0x' + '1'.repeat(40);
const B = '0x' + '2'.repeat(40);

function flush() {
  vi.advanceTimersByTime(80);
  return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());
}

describe('peer profiles', () => {
  let store: MemStorage;
  beforeEach(() => {
    vi.useFakeTimers();
    __resetPeerProfiles();
    // The suite runs in node: a window with its own storage stands in for the browser.
    store = new MemStorage();
    vi.stubGlobal('window', { localStorage: store });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks for several people in one request and notifies their avatars', async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const { addresses } = JSON.parse(init.body);
      expect(addresses.sort()).toEqual([A, B].sort());
      return new Response(JSON.stringify({ profiles: { [A]: { avatarUrl: 'data:image/png;base64,AAAA', displayName: 'Ana' } } }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const seen: string[] = [];
    subscribePeerProfile(A, () => seen.push(getPeerProfile(A)!.avatarUrl));
    requestPeerProfile(A);
    requestPeerProfile(B.toUpperCase().replace('0X', '0x'));
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getPeerProfile(A)?.avatarUrl).toBe('data:image/png;base64,AAAA');
    expect(getPeerProfile(B)?.avatarUrl ?? '').toBe('');
    expect(seen).toEqual(['data:image/png;base64,AAAA']);
    // kept on the device for the next visit
    expect(store.getItem(`peer_avatar_${A}`)).toBe('data:image/png;base64,AAAA');
  });

  it('keeps the photo it has when the server fails', async () => {
    setPeerProfile(A, { avatarUrl: '/photo.jpg' }, 1);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"rate limited"}', { status: 429 })));
    requestPeerProfile(A, true);
    await flush();
    await flush();
    expect(getPeerProfile(A)?.avatarUrl).toBe('/photo.jpg');
  });

  it('does not ask again while the answer is fresh, and does when forced', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ profiles: {} }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setPeerProfile(A, { avatarUrl: '/p.jpg' });
    requestPeerProfile(A);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(0);
    requestPeerProfile(A, true);
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // the server says there is no photo any more: it is removed
    expect(getPeerProfile(A)?.avatarUrl).toBe('');
  });

  it('ignores things that are not addresses', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    requestPeerProfile('alice');
    requestPeerProfile('');
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is what the chat avatars use, and the profile screen publishes the photo', () => {
    const chat = readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    const avatar = chat.slice(chat.indexOf('function Avatar('), chat.indexOf('const shortAddr'));
    expect(avatar).toMatch(/subscribePeerProfile\(address/);
    expect(avatar).toMatch(/requestPeerProfile\(address\)/);
    expect(avatar).not.toMatch(/api\/user\/search/);
    const settings = readFileSync('components/terminal/LedgerChatSettings.tsx', 'utf8');
    const edit = settings.slice(settings.indexOf('const handleAvatarChange'), settings.indexOf('const handleSave'));
    expect(edit).toMatch(/downscaleAvatar\(file\)/);
    expect(edit).toMatch(/pushPublicProfile\(/);
  });

  it('the batch route needs a session and checks its input', async () => {
    const { POST } = await import('@/app/api/user/profiles/route');
    const { NextRequest } = await import('next/server');
    const noSession = await POST(new NextRequest('http://localhost/api/user/profiles', { method: 'POST', body: JSON.stringify({ addresses: [A] }) }));
    expect(noSession.status).toBe(401);
    const bad = await POST(new NextRequest('http://localhost/api/user/profiles', { method: 'POST', body: '{"addresses":"x"}', headers: { 'x-verified-session-address': A } }));
    expect(bad.status).toBe(400);
    const empty = await POST(new NextRequest('http://localhost/api/user/profiles', { method: 'POST', body: JSON.stringify({ addresses: ['nope'] }), headers: { 'x-verified-session-address': A } }));
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ profiles: {} });
  });
});
