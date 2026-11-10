/**
 * lib/aztec/peer-binding.ts
 *
 * Which Aztec address belongs to the person at the other end of an XMTP DM.
 *
 * verifyAgreementInvite (lib/aztec/agreement-invite.ts) accepts an invitation
 * only if its sender is the conversation peer's Aztec address. XMTP
 * authenticates the peer's inbox (bound to an Ethereum identity); it says
 * nothing about Aztec. The peer therefore announces its Aztec address in the
 * same DM:
 *
 *   { "type": "hl.aztec_address", "version": 1, "address": "0x…" }
 *
 * and the receiver pins it on first sight (trust on first use), keyed by the
 * peer's XMTP inbox ID. Later announcements of the same address are no-ops; a
 * different address is reported as a conflict and never replaces the pinned
 * one silently. Replacing it takes an explicit call (repinPeerAztecAddress)
 * after the user has confirmed the change with the peer by other means.
 *
 * Version 1 (above) proves nothing about control: the pinned address means
 * "the address this XMTP identity gave us". Version 2 (gate G7) adds a proof:
 *
 *   { "type": "hl.aztec_address", "version": 2, "address": "0x…", "proof": {
 *       "scheme": "hl/aztec-binding/v1",
 *       "signingPublicKey": { "x": "0x…", "y": "0x…" },   Grumpkin point
 *       "salt": "0x…", "publicKeys": "0x…",                 PublicKeys.toString()
 *       "signerInboxId": "…", "recipientInboxId": "…",
 *       "signature": "0x…" } }                               Schnorr, 64 bytes
 *
 * The receiver checks, in this order:
 *  1. signerInboxId is the XMTP-authenticated sender of the message, and
 *     recipientInboxId is the receiver itself (a proof made for one person
 *     cannot be replayed to another, or claimed by someone else);
 *  2. the announced address is exactly the Schnorr account address computed
 *     from (SchnorrAccount artifact, constructor args = signing public key,
 *     salt, publicKeys) — what AccountManager.create does in aztec.js v6.0.0,
 *     with no deployer and no immutables hash (EmbeddedWallet 'schnorr');
 *  3. the Schnorr signature verifies with that signing public key over
 *     sha256ToField("hl/aztec-binding/v1 | <address> | <signerInboxId> | dm:<recipientInboxId>").
 * Only then is the address pinned as VERIFIED. A v2 announcement that fails
 * any check is rejected and never pinned.
 *
 * What a valid proof establishes: the sender holds the signing key that
 * authorises transactions for that address. It does not prove the sender
 * holds the address's privacy keys (publicKeys are public data). A peer could
 * announce an address built from someone else's public keys and their own
 * signing key; funds sent there would be unusable by both. That only harms
 * people who pay that peer, which a dishonest peer can do anyway, so the
 * proof still closes the attack G7 is about: a third party, or a relay,
 * substituting its own address for the peer's.
 */
import { z } from 'zod';

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'expected a 32-byte hex value');

export const AztecAddressAnnouncementSchema = z
  .object({
    type: z.literal('hl.aztec_address'),
    version: z.literal(1),
    address: hex32.refine((a) => !/^0x0{64}$/.test(a), 'zero address'),
  })
  .strict();
export type AztecAddressAnnouncement = z.infer<typeof AztecAddressAnnouncementSchema>;

export const BINDING_SCHEME = 'hl/aztec-binding/v1';

const inboxId = z.string().min(1).max(128).regex(/^[0-9A-Za-z_.:-]+$/, 'unexpected inbox id');

export const AddressProofSchema = z
  .object({
    scheme: z.literal(BINDING_SCHEME),
    signingPublicKey: z.object({ x: hex32, y: hex32 }).strict(),
    salt: hex32,
    publicKeys: z.string().regex(/^0x[0-9a-fA-F]{64,2048}$/, 'expected PublicKeys hex'),
    signerInboxId: inboxId,
    recipientInboxId: inboxId,
    signature: z.string().regex(/^0x[0-9a-fA-F]{128}$/, 'expected a 64-byte Schnorr signature'),
  })
  .strict();
export type AddressProof = z.infer<typeof AddressProofSchema>;

export const AztecAddressAnnouncementV2Schema = z
  .object({
    type: z.literal('hl.aztec_address'),
    version: z.literal(2),
    address: hex32.refine((a) => !/^0x0{64}$/.test(a), 'zero address'),
    proof: AddressProofSchema,
  })
  .strict();
export type AztecAddressAnnouncementV2 = z.infer<typeof AztecAddressAnnouncementV2Schema>;

/** Largest announcement accepted, in bytes (v1 is about 110, v2 about 1,300). */
export const MAX_ANNOUNCEMENT_BYTES = 4096;

/** The exact text whose sha256ToField the peer signs. */
export function bindingStatement(address: string, signerInboxId: string, recipientInboxId: string): string {
  return `${BINDING_SCHEME} | ${address.toLowerCase()} | ${signerInboxId} | dm:${recipientInboxId}`;
}

/**
 * The cryptography G7 needs, injectable so the protocol logic is testable
 * without WASM. sdkBindingCrypto() is the real one (Aztec v6.0.0).
 */
export interface BindingCrypto {
  /** sha256ToField of the UTF-8 statement, as 0x hex. */
  messageField(statement: string): Promise<string>;
  /** Schnorr (Grumpkin) verification. */
  verify(messageField: string, signingPublicKey: { x: string; y: string }, signature: string): Promise<boolean>;
  /** Address of the Schnorr account with these parameters. */
  accountAddress(p: { signingPublicKey: { x: string; y: string }; salt: string; publicKeys: string }): Promise<string>;
}

export type ProofCheck = { ok: true } | { ok: false; reason: string };

/** Checks a v2 proof against who sent it and who received it. Never throws. */
export async function verifyAddressProof(
  ann: AztecAddressAnnouncementV2,
  ctx: { senderInboxId: string; selfInboxId: string },
  crypto: BindingCrypto,
): Promise<ProofCheck> {
  const p = ann.proof;
  if (p.signerInboxId.toLowerCase() !== ctx.senderInboxId.toLowerCase()) {
    return { ok: false, reason: 'the proof was made by someone other than the sender' };
  }
  if (p.recipientInboxId.toLowerCase() !== ctx.selfInboxId.toLowerCase()) {
    return { ok: false, reason: 'the proof was made for someone else (replayed)' };
  }
  try {
    const derived = await crypto.accountAddress({ signingPublicKey: p.signingPublicKey, salt: p.salt, publicKeys: p.publicKeys });
    if (derived.toLowerCase() !== ann.address.toLowerCase()) {
      return { ok: false, reason: 'the keys in the proof do not produce this address' };
    }
    const msg = await crypto.messageField(bindingStatement(ann.address, p.signerInboxId, p.recipientInboxId));
    if (!(await crypto.verify(msg, p.signingPublicKey, p.signature))) {
      return { ok: false, reason: 'the signature does not verify' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'the proof could not be checked' };
  }
}

/** Builds a v2 announcement string from a proof made by the wallet (client.ts aztecAddressProof). */
export function verifiedAnnouncementFor(address: string, proof: AddressProof): string {
  const a: AztecAddressAnnouncementV2 = { type: 'hl.aztec_address', version: 2, address: address.toLowerCase(), proof };
  return JSON.stringify(AztecAddressAnnouncementV2Schema.parse(a));
}

/**
 * The real cryptography, from the Aztec v6.0.0 packages (loaded on demand,
 * browser only in practice: Schnorr runs in bb.js WASM).
 */
export async function sdkBindingCrypto(): Promise<BindingCrypto> {
  const [schnorrMod, shaMod, bn, grumpkin, contracts, keys, accounts] = await Promise.all([
    import('@aztec-labs/foundation/crypto/schnorr'),
    import('@aztec-labs/foundation/crypto/sha256'),
    import('@aztec-labs/foundation/curves/bn254'),
    import('@aztec-labs/foundation/curves/grumpkin'),
    import('@aztec-labs/aztec.js/contracts'),
    import('@aztec-labs/aztec.js/keys'),
    import('@aztec-labs/accounts/schnorr'),
  ]);
  const { Schnorr, SchnorrSignature } = schnorrMod as any;
  const { sha256ToField } = shaMod as any;
  const { Fr } = bn as any;
  const { Point } = grumpkin as any;
  const { getContractInstanceFromInstantiationParams } = contracts as any;
  const { PublicKeys } = keys as any;
  const { SchnorrAccountContractArtifact } = accounts as any;
  const point = (k: { x: string; y: string }) =>
    Point.fromBuffer(Buffer.concat([Buffer.from(k.x.slice(2), 'hex'), Buffer.from(k.y.slice(2), 'hex')]));
  return {
    async messageField(statement) {
      return sha256ToField([Buffer.from(statement, 'utf8')]).toString();
    },
    async verify(msg, pk, sig) {
      return new Schnorr().verifySignature(Fr.fromHexString(msg), point(pk), new SchnorrSignature(Buffer.from(sig.slice(2), 'hex')));
    },
    async accountAddress({ signingPublicKey, salt, publicKeys }) {
      const instance = await getContractInstanceFromInstantiationParams(SchnorrAccountContractArtifact, {
        constructorArtifact: 'constructor',
        constructorArgs: [Fr.fromHexString(signingPublicKey.x), Fr.fromHexString(signingPublicKey.y)],
        salt: Fr.fromHexString(salt),
        publicKeys: PublicKeys.fromString(publicKeys),
      });
      return instance.address.toString();
    },
  };
}

/** Persistent per-device storage of pinned addresses, keyed by XMTP inbox ID. */
export interface PeerBindingStore {
  get(peerInboxId: string): Promise<string | undefined>;
  set(peerInboxId: string, aztecAddress: string): Promise<void>;
}

export type AnnouncementResult =
  | { status: 'pinned'; address: string; verified?: true }
  | { status: 'unchanged'; address: string; verified?: true }
  | { status: 'conflict'; pinned: string; announced: string; verified?: true }
  /** A v2 announcement whose proof failed: never pinned. Show a security warning. */
  | { status: 'rejected'; address: string; reason: string }
  | { status: 'ignored'; reason: string };

const VERIFIED = (peerInboxId: string) => `verified:${peerInboxId}`;
/** The v2 announcement whose proof was checked; re-verified before value moves (verifiedPeerBinding). */
const PROOF = (peerInboxId: string) => `proof:${peerInboxId}`;

export function announcementFor(address: string): string {
  const a: AztecAddressAnnouncement = { type: 'hl.aztec_address', version: 1, address: address.toLowerCase() };
  return JSON.stringify(AztecAddressAnnouncementSchema.parse(a));
}

/** Parses a message body; undefined when it is not a valid announcement (v1 or v2). Never throws. */
export function parseAnnouncement(raw: unknown): AztecAddressAnnouncement | AztecAddressAnnouncementV2 | undefined {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_ANNOUNCEMENT_BYTES) return undefined;
  try {
    const json = JSON.parse(raw);
    const p = json?.version === 2 ? AztecAddressAnnouncementV2Schema.safeParse(json) : AztecAddressAnnouncementSchema.safeParse(json);
    return p.success ? p.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Handles one DM message that may be an announcement. `senderInboxId` is the
 * sender XMTP reports for the message and `peerInboxId` the DM's peer: an
 * announcement counts only when they are the same inbox, so a copy of our own
 * announcement, or a message relayed from elsewhere, can never pin anything.
 */
export async function recordPeerAnnouncement(
  store: PeerBindingStore,
  msg: { senderInboxId: string; peerInboxId: string; body: unknown; selfInboxId?: string },
  crypto?: BindingCrypto,
): Promise<AnnouncementResult> {
  const ann = parseAnnouncement(msg.body);
  if (!ann) return { status: 'ignored', reason: 'not an announcement' };
  if (!msg.peerInboxId || msg.senderInboxId !== msg.peerInboxId) {
    return { status: 'ignored', reason: 'announcement not sent by the conversation peer' };
  }
  const announced = ann.address.toLowerCase();

  let verified = false;
  if (ann.version === 2) {
    if (!crypto || !msg.selfInboxId) return { status: 'ignored', reason: 'cannot check the proof here' };
    const check = await verifyAddressProof(ann, { senderInboxId: msg.senderInboxId, selfInboxId: msg.selfInboxId }, crypto);
    if (!check.ok) return { status: 'rejected', address: announced, reason: check.reason };
    verified = true;
  }

  const pinned = await store.get(msg.peerInboxId);
  if (pinned === undefined) {
    await store.set(msg.peerInboxId, announced);
    if (verified) await store.set(PROOF(msg.peerInboxId), JSON.stringify(ann));
    if (verified) await store.set(VERIFIED(msg.peerInboxId), announced);
    return verified ? { status: 'pinned', address: announced, verified: true } : { status: 'pinned', address: announced };
  }
  if (pinned.toLowerCase() === announced) {
    // A proof for the address already pinned (on trust) upgrades it to verified.
    if (verified) await store.set(PROOF(msg.peerInboxId), JSON.stringify(ann));
    if (verified) await store.set(VERIFIED(msg.peerInboxId), announced);
    return verified ? { status: 'unchanged', address: announced, verified: true } : { status: 'unchanged', address: announced };
  }
  // Even a valid proof never silently replaces a pinned address: the peer may
  // have moved accounts, or their XMTP identity may be compromised.
  return verified ? { status: 'conflict', pinned, announced, verified: true } : { status: 'conflict', pinned, announced };
}

/** The pinned address of a DM peer and whether a G7 proof was verified for exactly that address. */
export async function peerBindingStatus(store: PeerBindingStore, peerInboxId: string): Promise<{ address?: string; verified: boolean }> {
  const address = await store.get(peerInboxId);
  if (!address) return { verified: false };
  const v = await store.get(VERIFIED(peerInboxId));
  return { address, verified: !!v && v.toLowerCase() === address.toLowerCase() };
}

/**
 * G7 status for moving value: true only if the stored v2 proof is for exactly
 * the pinned address and passes a fresh Schnorr + address recomputation now.
 * The cached `verified:` marker alone is never trusted (storage is writable).
 * Never throws.
 */
export async function verifiedPeerBinding(
  store: PeerBindingStore,
  peerInboxId: string,
  selfInboxId: string,
  crypto: BindingCrypto,
): Promise<{ address?: string; verified: boolean }> {
  try {
    const address = await store.get(peerInboxId);
    if (!address) return { verified: false };
    if (!selfInboxId) return { address, verified: false };
    const ann = parseAnnouncement(await store.get(PROOF(peerInboxId)));
    if (!ann || ann.version !== 2 || ann.address.toLowerCase() !== address.toLowerCase()) return { address, verified: false };
    const check = await verifyAddressProof(ann, { senderInboxId: peerInboxId, selfInboxId }, crypto);
    return { address, verified: check.ok };
  } catch {
    return { verified: false };
  }
}

/** The pinned Aztec address of a DM peer, to pass as `peer` to verifyAgreementInvite. */
export async function peerAztecAddress(store: PeerBindingStore, peerInboxId: string): Promise<string | undefined> {
  return store.get(peerInboxId);
}

/** Replaces a pinned address. Call only after the user confirmed the change with the peer. */
export async function repinPeerAztecAddress(store: PeerBindingStore, peerInboxId: string, address: string): Promise<void> {
  const ann = AztecAddressAnnouncementSchema.parse({ type: 'hl.aztec_address', version: 1, address });
  await store.set(peerInboxId, ann.address.toLowerCase());
}

/** In-memory store, for tests and for a session without persistence. */
export function memoryPeerBindingStore(): PeerBindingStore {
  const m = new Map<string, string>();
  return {
    async get(k) {
      return m.get(k);
    },
    async set(k, v) {
      m.set(k, v);
    },
  };
}

/**
 * Browser store: pins persist per device in localStorage under `prefix`.
 * Every pin is also kept in memory, so when storage is blocked (private mode,
 * site data disabled) a pin still holds for the session and a later,
 * different announcement is still reported as a conflict.
 */
export function localStoragePeerBindingStore(prefix = 'hl.aztec_peer.', storage?: Storage): PeerBindingStore {
  const memory = new Map<string, string>();
  const ls = (): Storage | undefined => {
    try {
      return storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    } catch {
      return undefined;
    }
  };
  return {
    async get(k) {
      try {
        const v = ls()?.getItem(prefix + k);
        if (v) return v;
      } catch {
        /* fall back to memory */
      }
      return memory.get(k);
    },
    async set(k, v) {
      memory.set(k, v);
      try {
        ls()?.setItem(prefix + k, v);
      } catch {
        /* kept in memory only */
      }
    },
  };
}
