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
 * What this does not do: prove that the peer controls the announced Aztec
 * account. The pinned address means "the address this XMTP identity gave us",
 * nothing more; the contract in an invitation is still recomputed from its
 * secret. Proof of control (a signature by the Aztec account over the inbox
 * ID) is open work, listed in docs/zk/AZTEC_CONTRACTS_REVIEW.md.
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

/** Largest announcement accepted, in bytes (a valid one is about 110). */
export const MAX_ANNOUNCEMENT_BYTES = 512;

/** Persistent per-device storage of pinned addresses, keyed by XMTP inbox ID. */
export interface PeerBindingStore {
  get(peerInboxId: string): Promise<string | undefined>;
  set(peerInboxId: string, aztecAddress: string): Promise<void>;
}

export type AnnouncementResult =
  | { status: 'pinned'; address: string }
  | { status: 'unchanged'; address: string }
  | { status: 'conflict'; pinned: string; announced: string }
  | { status: 'ignored'; reason: string };

export function announcementFor(address: string): string {
  const a: AztecAddressAnnouncement = { type: 'hl.aztec_address', version: 1, address: address.toLowerCase() };
  return JSON.stringify(AztecAddressAnnouncementSchema.parse(a));
}

/** Parses a message body; undefined when it is not a valid announcement. Never throws. */
export function parseAnnouncement(raw: unknown): AztecAddressAnnouncement | undefined {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_ANNOUNCEMENT_BYTES) return undefined;
  try {
    const p = AztecAddressAnnouncementSchema.safeParse(JSON.parse(raw));
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
  msg: { senderInboxId: string; peerInboxId: string; body: unknown },
): Promise<AnnouncementResult> {
  const ann = parseAnnouncement(msg.body);
  if (!ann) return { status: 'ignored', reason: 'not an announcement' };
  if (!msg.peerInboxId || msg.senderInboxId !== msg.peerInboxId) {
    return { status: 'ignored', reason: 'announcement not sent by the conversation peer' };
  }
  const announced = ann.address.toLowerCase();
  const pinned = await store.get(msg.peerInboxId);
  if (pinned === undefined) {
    await store.set(msg.peerInboxId, announced);
    return { status: 'pinned', address: announced };
  }
  if (pinned.toLowerCase() === announced) return { status: 'unchanged', address: announced };
  return { status: 'conflict', pinned, announced };
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
