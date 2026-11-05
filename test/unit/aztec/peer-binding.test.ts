/**
 * The DM peer's Aztec address is pinned on first use, only from the peer's
 * own inbox, and never replaced silently.
 */
import { describe, it, expect } from 'vitest';
import {
  announcementFor,
  parseAnnouncement,
  recordPeerAnnouncement,
  peerAztecAddress,
  repinPeerAztecAddress,
  memoryPeerBindingStore,
  MAX_ANNOUNCEMENT_BYTES,
} from '@/lib/aztec/peer-binding';

const A = '0x' + '1a'.repeat(32);
const B = '0x' + '2b'.repeat(32);
const PEER = 'inbox-peer';
const ME = 'inbox-me';

describe('peer Aztec address binding', () => {
  it('round-trips an announcement and lowercases the address', () => {
    const raw = announcementFor(A.toUpperCase().replace('0X', '0x'));
    expect(parseAnnouncement(raw)).toEqual({ type: 'hl.aztec_address', version: 1, address: A });
  });

  it('rejects malformed, oversized, zero-address and extra-field announcements', () => {
    expect(parseAnnouncement('not json')).toBeUndefined();
    expect(parseAnnouncement(42)).toBeUndefined();
    expect(parseAnnouncement(JSON.stringify({ type: 'hl.aztec_address', version: 1, address: '0x1234' }))).toBeUndefined();
    expect(parseAnnouncement(JSON.stringify({ type: 'hl.aztec_address', version: 2, address: A }))).toBeUndefined();
    expect(parseAnnouncement(JSON.stringify({ type: 'hl.aztec_address', version: 1, address: '0x' + '0'.repeat(64) }))).toBeUndefined();
    expect(parseAnnouncement(JSON.stringify({ type: 'hl.aztec_address', version: 1, address: A, extra: 1 }))).toBeUndefined();
    expect(parseAnnouncement(' '.repeat(MAX_ANNOUNCEMENT_BYTES) + announcementFor(A))).toBeUndefined();
    expect(() => announcementFor('0x1234')).toThrow();
  });

  it('pins on first sight, then reports the same address as unchanged', async () => {
    const store = memoryPeerBindingStore();
    const msg = { senderInboxId: PEER, peerInboxId: PEER, body: announcementFor(A) };
    expect(await recordPeerAnnouncement(store, msg)).toEqual({ status: 'pinned', address: A });
    expect(await recordPeerAnnouncement(store, msg)).toEqual({ status: 'unchanged', address: A });
    expect(await peerAztecAddress(store, PEER)).toBe(A);
  });

  it('reports a different address as a conflict and keeps the pinned one', async () => {
    const store = memoryPeerBindingStore();
    await recordPeerAnnouncement(store, { senderInboxId: PEER, peerInboxId: PEER, body: announcementFor(A) });
    const r = await recordPeerAnnouncement(store, { senderInboxId: PEER, peerInboxId: PEER, body: announcementFor(B) });
    expect(r).toEqual({ status: 'conflict', pinned: A, announced: B });
    expect(await peerAztecAddress(store, PEER)).toBe(A);
  });

  it('ignores announcements not sent by the peer, including our own', async () => {
    const store = memoryPeerBindingStore();
    const r = await recordPeerAnnouncement(store, { senderInboxId: ME, peerInboxId: PEER, body: announcementFor(B) });
    expect(r.status).toBe('ignored');
    expect(await recordPeerAnnouncement(store, { senderInboxId: '', peerInboxId: '', body: announcementFor(B) })).toMatchObject({ status: 'ignored' });
    expect(await peerAztecAddress(store, PEER)).toBeUndefined();
  });

  it('ignores ordinary chat messages', async () => {
    const store = memoryPeerBindingStore();
    expect((await recordPeerAnnouncement(store, { senderInboxId: PEER, peerInboxId: PEER, body: 'hola' })).status).toBe('ignored');
  });

  it('replaces a pinned address only through an explicit repin', async () => {
    const store = memoryPeerBindingStore();
    await recordPeerAnnouncement(store, { senderInboxId: PEER, peerInboxId: PEER, body: announcementFor(A) });
    await repinPeerAztecAddress(store, PEER, B);
    expect(await peerAztecAddress(store, PEER)).toBe(B);
    await expect(repinPeerAztecAddress(store, PEER, '0xdead')).rejects.toThrow();
  });
});

describe('localStoragePeerBindingStore', () => {
  const fakeStorage = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: () => null,
      get length() {
        return m.size;
      },
    } as Storage;
  };

  it('persists pins under its prefix', async () => {
    const st = fakeStorage();
    const store = (await import('@/lib/aztec/peer-binding')).localStoragePeerBindingStore('p.', st);
    await recordPeerAnnouncement(store, { senderInboxId: PEER, peerInboxId: PEER, body: announcementFor(A) });
    expect(st.getItem('p.' + PEER)).toBe(A);
  });

  it('keeps pins in memory when storage throws, so a conflict is still caught', async () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
    const store = (await import('@/lib/aztec/peer-binding')).localStoragePeerBindingStore('p.', broken);
    expect(await peerAztecAddress(store, PEER)).toBeUndefined();
    await recordPeerAnnouncement(store, { senderInboxId: PEER, peerInboxId: PEER, body: announcementFor(A) });
    const r = await recordPeerAnnouncement(store, { senderInboxId: PEER, peerInboxId: PEER, body: announcementFor(B) });
    expect(r.status).toBe('conflict');
  });
});
