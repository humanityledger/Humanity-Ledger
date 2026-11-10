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

// ─── G7: signed announcements (version 2) ───────────────────────────────────
import { createHash } from 'node:crypto';
import {
  BINDING_SCHEME,
  bindingStatement,
  peerBindingStatus,
  verifiedAnnouncementFor,
  verifyAddressProof,
  type AddressProof,
  type BindingCrypto,
} from '@/lib/aztec/peer-binding';

const h = (s: string) => '0x' + createHash('sha256').update(s).digest('hex');
/** Deterministic stand-in for Schnorr + address derivation: same rules, no WASM. */
const fakeCrypto: BindingCrypto = {
  async messageField(statement) {
    return h(statement);
  },
  async verify(msg, pk, sig) {
    return sig === h(msg + pk.x) + h(msg + pk.y).slice(2);
  },
  async accountAddress({ signingPublicKey, salt, publicKeys }) {
    return h(signingPublicKey.x + signingPublicKey.y + salt + publicKeys);
  },
};
const SIGNER = 'signerinbox01';
const ME_INBOX = 'myinbox02';
const PK = { x: h('x'), y: h('y') };
const SALT = h('salt');
const KEYS = '0x' + 'ab'.repeat(200);
const ADDR = h(PK.x + PK.y + SALT + KEYS);

async function proofFor(recipient = ME_INBOX, signer = SIGNER, address = ADDR): Promise<AddressProof> {
  const msg = await fakeCrypto.messageField(bindingStatement(address, signer, recipient));
  return {
    scheme: BINDING_SCHEME,
    signingPublicKey: PK,
    salt: SALT,
    publicKeys: KEYS,
    signerInboxId: signer,
    recipientInboxId: recipient,
    signature: h(msg + PK.x) + h(msg + PK.y).slice(2),
  };
}

describe('G7 address proofs', () => {
  it('signs the exact statement format', () => {
    expect(bindingStatement('0xABC', 'a', 'b')).toBe('hl/aztec-binding/v1 | 0xabc | a | dm:b');
  });

  it('pins a verified address, and the status reports it verified', async () => {
    const store = memoryPeerBindingStore();
    const body = verifiedAnnouncementFor(ADDR, await proofFor());
    const r = await recordPeerAnnouncement(store, { senderInboxId: SIGNER, peerInboxId: SIGNER, selfInboxId: ME_INBOX, body }, fakeCrypto);
    expect(r).toEqual({ status: 'pinned', address: ADDR, verified: true });
    expect(await peerBindingStatus(store, SIGNER)).toEqual({ address: ADDR, verified: true });
  });

  it('rejects a proof replayed to someone else, claimed by another sender, or with a bad signature', async () => {
    const ann = { type: 'hl.aztec_address' as const, version: 2 as const, address: ADDR, proof: await proofFor('someoneelse') };
    expect(await verifyAddressProof(ann, { senderInboxId: SIGNER, selfInboxId: ME_INBOX }, fakeCrypto)).toEqual({ ok: false, reason: 'the proof was made for someone else (replayed)' });
    const mine = { ...ann, proof: await proofFor() };
    expect((await verifyAddressProof(mine, { senderInboxId: 'mallory', selfInboxId: ME_INBOX }, fakeCrypto)).ok).toBe(false);
    const forged = { ...mine, proof: { ...mine.proof, signature: '0x' + '11'.repeat(64) } };
    expect(await verifyAddressProof(forged, { senderInboxId: SIGNER, selfInboxId: ME_INBOX }, fakeCrypto)).toEqual({ ok: false, reason: 'the signature does not verify' });
  });

  it('rejects an address that the keys in the proof do not produce, and never pins it', async () => {
    const store = memoryPeerBindingStore();
    const other = h('attacker address');
    const body = verifiedAnnouncementFor(other, await proofFor(ME_INBOX, SIGNER, other));
    const r = await recordPeerAnnouncement(store, { senderInboxId: SIGNER, peerInboxId: SIGNER, selfInboxId: ME_INBOX, body }, fakeCrypto);
    expect(r).toEqual({ status: 'rejected', address: other, reason: 'the keys in the proof do not produce this address' });
    expect(await peerBindingStatus(store, SIGNER)).toEqual({ verified: false });
  });

  it('upgrades a trusted pin to verified, keeps v1 pins unverified, and never replaces a pin silently', async () => {
    const store = memoryPeerBindingStore();
    await recordPeerAnnouncement(store, { senderInboxId: SIGNER, peerInboxId: SIGNER, body: announcementFor(ADDR) });
    expect(await peerBindingStatus(store, SIGNER)).toEqual({ address: ADDR, verified: false });
    const body = verifiedAnnouncementFor(ADDR, await proofFor());
    expect(await recordPeerAnnouncement(store, { senderInboxId: SIGNER, peerInboxId: SIGNER, selfInboxId: ME_INBOX, body }, fakeCrypto)).toEqual({ status: 'unchanged', address: ADDR, verified: true });
    expect((await peerBindingStatus(store, SIGNER)).verified).toBe(true);

    const pk2 = { x: h('x2'), y: h('y2') };
    const addr2 = h(pk2.x + pk2.y + SALT + KEYS);
    const msg2 = await fakeCrypto.messageField(bindingStatement(addr2, SIGNER, ME_INBOX));
    const p2: AddressProof = { ...(await proofFor()), signingPublicKey: pk2, signature: h(msg2 + pk2.x) + h(msg2 + pk2.y).slice(2) };
    const r = await recordPeerAnnouncement(store, { senderInboxId: SIGNER, peerInboxId: SIGNER, selfInboxId: ME_INBOX, body: verifiedAnnouncementFor(addr2, p2) }, fakeCrypto);
    expect(r.status).toBe('conflict');
    expect(await peerBindingStatus(store, SIGNER)).toEqual({ address: ADDR, verified: true });
  });

  it('a repin to another address drops the verified status', async () => {
    const store = memoryPeerBindingStore();
    await recordPeerAnnouncement(store, { senderInboxId: SIGNER, peerInboxId: SIGNER, selfInboxId: ME_INBOX, body: verifiedAnnouncementFor(ADDR, await proofFor()) }, fakeCrypto);
    await repinPeerAztecAddress(store, SIGNER, h('new'));
    expect((await peerBindingStatus(store, SIGNER)).verified).toBe(false);
  });

  it('does not pin a signed announcement it cannot check', async () => {
    const store = memoryPeerBindingStore();
    const body = verifiedAnnouncementFor(ADDR, await proofFor());
    expect((await recordPeerAnnouncement(store, { senderInboxId: SIGNER, peerInboxId: SIGNER, body })).status).toBe('ignored');
    expect(await peerBindingStatus(store, SIGNER)).toEqual({ verified: false });
  });
});
