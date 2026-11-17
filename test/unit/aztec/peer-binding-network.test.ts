/**
 * G7 scheme v2: the proof names the Aztec network. Refusal cases for moving value.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  BINDING_SCHEME_V1,
  BINDING_SCHEME_V2,
  bindingStatement,
  memoryPeerBindingStore,
  networkTagOf,
  parseAnnouncement,
  recordPeerAnnouncement,
  valueBindingContext,
  verifiedAnnouncementFor,
  verifiedPeerBinding,
  verifyAddressProof,
  type AddressProof,
  type BindingCrypto,
} from '@/lib/aztec/peer-binding';
import { checkDirectPaymentPolicy } from '@/lib/payments/direct-private';

const h = (s: string) => '0x' + createHash('sha256').update(s).digest('hex');
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
const PEER = 'peerinbox01';
const ME = 'myinbox02';
const PK = { x: h('x'), y: h('y') };
const SALT = h('salt');
const KEYS = '0x' + 'ab'.repeat(200);
const ADDR = h(PK.x + PK.y + SALT + KEYS);
const ALPHA = networkTagOf({ l1ChainId: 1, rollupVersion: 679261766 });
const TESTNET = networkTagOf({ l1ChainId: 11155111, rollupVersion: 2070860440 });

async function proof(network?: string, recipient = ME): Promise<AddressProof> {
  const msg = await fakeCrypto.messageField(bindingStatement(ADDR, PEER, recipient, network));
  const base = {
    signingPublicKey: PK,
    salt: SALT,
    publicKeys: KEYS,
    signerInboxId: PEER,
    recipientInboxId: recipient,
    signature: h(msg + PK.x) + h(msg + PK.y).slice(2),
  };
  return network ? { scheme: BINDING_SCHEME_V2, network, ...base } : { scheme: BINDING_SCHEME_V1, ...base };
}
const ann = (p: AddressProof) => ({ type: 'hl.aztec_address' as const, version: 2 as const, address: ADDR, proof: p });

async function pinned(p: AddressProof) {
  const store = memoryPeerBindingStore();
  await recordPeerAnnouncement(store, { senderInboxId: PEER, peerInboxId: PEER, selfInboxId: ME, body: verifiedAnnouncementFor(ADDR, p) }, fakeCrypto);
  return store;
}

describe('G7 scheme v2 (network-bound)', () => {
  it('signs the network into the statement, and tags networks from node info', () => {
    expect(bindingStatement('0xABC', 'a', 'b', 'aztec:1:7')).toBe('hl/aztec-binding/v2 | 0xabc | a | dm:b | net:aztec:1:7');
    expect(ALPHA).toBe('aztec:1:679261766');
    expect(() => bindingStatement('0xabc', 'a', 'b', 'mainnet')).toThrow();
  });

  it('a v2 proof names its network; a v1 proof does not (schema)', async () => {
    expect(parseAnnouncement(verifiedAnnouncementFor(ADDR, await proof(ALPHA)))).toBeDefined();
    const v2NoNet = { ...(await proof(ALPHA)), network: undefined };
    expect(parseAnnouncement(JSON.stringify(ann(v2NoNet as any)))).toBeUndefined();
    const v1WithNet = { ...(await proof()), network: ALPHA };
    expect(parseAnnouncement(JSON.stringify(ann(v1WithNet as any)))).toBeUndefined();
  });

  it('accepts a proof for this network', async () => {
    expect(await verifyAddressProof(ann(await proof(ALPHA)), { senderInboxId: PEER, selfInboxId: ME, network: ALPHA, requireNetwork: true }, fakeCrypto)).toEqual({ ok: true });
  });

  it('refuses a proof made on the test network when value moves on Alpha', async () => {
    const r = await verifyAddressProof(ann(await proof(TESTNET)), { senderInboxId: PEER, selfInboxId: ME, network: ALPHA, requireNetwork: true }, fakeCrypto);
    expect(r).toEqual({ ok: false, reason: 'the proof was made for another Aztec network' });
  });

  it('refuses a v1-scheme proof on Alpha, accepts it on the test network', async () => {
    const v1 = ann(await proof());
    expect((await verifyAddressProof(v1, { senderInboxId: PEER, selfInboxId: ME, ...valueBindingContext(ALPHA, 'mainnet') }, fakeCrypto)).ok).toBe(false);
    expect((await verifyAddressProof(v1, { senderInboxId: PEER, selfInboxId: ME, ...valueBindingContext(TESTNET, 'testnet') }, fakeCrypto)).ok).toBe(true);
  });

  it('fails closed on Alpha when the wallet does not know its network', async () => {
    const r = await verifyAddressProof(ann(await proof(ALPHA)), { senderInboxId: PEER, selfInboxId: ME, ...valueBindingContext(undefined, 'mainnet') }, fakeCrypto);
    expect(r).toEqual({ ok: false, reason: 'this wallet does not know its Aztec network yet' });
  });

  it('a network swapped into a signed proof breaks the signature', async () => {
    const p = { ...(await proof(TESTNET)), network: ALPHA };
    const r = await verifyAddressProof(ann(p), { senderInboxId: PEER, selfInboxId: ME, network: ALPHA, requireNetwork: true }, fakeCrypto);
    expect(r).toEqual({ ok: false, reason: 'the signature does not verify' });
  });

  it('never pins a proof for another network when the wallet knows its own', async () => {
    const store = memoryPeerBindingStore();
    const r = await recordPeerAnnouncement(
      store,
      { senderInboxId: PEER, peerInboxId: PEER, selfInboxId: ME, body: verifiedAnnouncementFor(ADDR, await proof(TESTNET)) },
      fakeCrypto,
      { network: ALPHA },
    );
    expect(r).toMatchObject({ status: 'rejected', reason: 'the proof was made for another Aztec network' });
    expect(await store.get(PEER)).toBeUndefined();
  });

  it('verifiedPeerBinding re-checks the stored proof with the network and says why it fails', async () => {
    const v1Store = await pinned(await proof());
    expect(await verifiedPeerBinding(v1Store, PEER, ME, fakeCrypto, valueBindingContext(ALPHA, 'mainnet'))).toEqual({
      address: ADDR,
      verified: false,
      reason: 'the proof does not name the Aztec network (made by an older Ledger Chat)',
    });
    const v2Store = await pinned(await proof(ALPHA));
    expect(await verifiedPeerBinding(v2Store, PEER, ME, fakeCrypto, valueBindingContext(ALPHA, 'mainnet'))).toEqual({ address: ADDR, verified: true });
    expect((await verifiedPeerBinding(memoryPeerBindingStore(), PEER, ME, fakeCrypto)).reason).toBe('no Aztec address was shared in this chat');
  });

  it('a tampered cached flag does not verify (only the stored proof counts)', async () => {
    const store = memoryPeerBindingStore();
    await store.set(PEER, ADDR);
    await store.set(`verified:${PEER}`, ADDR);
    expect((await verifiedPeerBinding(store, PEER, ME, fakeCrypto, valueBindingContext(ALPHA, 'mainnet'))).verified).toBe(false);
  });

  it('the direct payment policy refuses an unverified payee on every network', () => {
    for (const network of ['testnet', 'mainnet'] as const) {
      const r = checkDirectPaymentPolicy({ network, token: '0xt', amount: 1n, caps: { '0xt': 10n }, peerVerified: false, acknowledgedUnaudited: true, acknowledgedPublicFeePayer: true });
      expect(r.ok).toBe(false);
    }
  });
});
