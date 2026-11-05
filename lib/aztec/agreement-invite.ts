/**
 * lib/aztec/agreement-invite.ts
 *
 * The invitation one party sends the other, over the XMTP conversation, when
 * it opens a private escrow or payment stream: one keyed contract instance
 * per agreement (lib/aztec/keyed-deploy.ts), whose secret only the two
 * parties hold.
 *
 * The receiver never trusts the address in an invitation. verifyAgreementInvite
 * recomputes the instance from the shared secret, salt, token and the
 * compiled artifact, and accepts the invitation only if
 *   - the message is well formed (strict schema, sizes bounded);
 *   - it is addressed to the receiver and comes from the conversation peer;
 *   - the token is one the receiver accepts;
 *   - the class is a current class from deployments/aztec-testnet.json;
 *   - the address and class recomputed from the secret are the ones claimed.
 * Without the last check, an invitation could point to a look-alike contract
 * whose code the receiver never audited, or to an instance whose keys the
 * receiver does not hold (funds the receiver could never claim).
 *
 * The secret gives both parties read access to every note of that instance,
 * which is why each agreement gets its own instance. Never log an invitation:
 * it carries the contract secret and, for an escrow, the claim secret.
 */
import { z } from 'zod';
import { Fr } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { computeKeyedInstance, type KeyedContract, type loadKeyedArtifact } from './keyed-deploy';

type Artifact = ReturnType<typeof loadKeyedArtifact>;

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'expected a 32-byte hex value');
const U128_MAX = (1n << 128n) - 1n;
const u128 = z
  .string()
  .regex(/^[0-9]{1,39}$/, 'expected a decimal integer')
  .refine((v) => BigInt(v) > 0n && BigInt(v) <= U128_MAX, 'out of u128 range');
const unixSeconds = z.number().int().positive().max(2 ** 40);

const base = {
  version: z.literal(1),
  instanceAddress: hex32,
  classId: hex32,
  salt: hex32,
  contractSecret: hex32,
  token: hex32,
  tokenSymbol: z.string().min(1).max(12),
  sender: hex32,
  recipient: hex32,
};

export const EscrowInviteSchema = z
  .object({
    type: z.literal('hl.escrow_invite'),
    ...base,
    escrowId: hex32,
    claimSecret: hex32,
    amount: u128,
    deadline: unixSeconds,
  })
  .strict();

export const StreamInviteSchema = z
  .object({
    type: z.literal('hl.stream_invite'),
    ...base,
    streamSalt: hex32,
    total: u128,
    rate: u128,
    start: unixSeconds,
  })
  .strict();

export const AgreementInviteSchema = z.discriminatedUnion('type', [EscrowInviteSchema, StreamInviteSchema]);
export type EscrowInvite = z.infer<typeof EscrowInviteSchema>;
export type StreamInvite = z.infer<typeof StreamInviteSchema>;
export type AgreementInvite = z.infer<typeof AgreementInviteSchema>;

/** Largest serialised invitation accepted, in bytes (a valid one is ~1 KB). */
export const MAX_INVITE_BYTES = 4096;

export const kindOf = (invite: AgreementInvite): KeyedContract => (invite.type === 'hl.escrow_invite' ? 'escrow' : 'streams');

export interface VerifyOptions {
  /** The compiled artifact for each kind (the one the receiver trusts). */
  artifacts: Readonly<Record<KeyedContract, Artifact>>;
  /** Class IDs the receiver accepts per kind (current entries of the deployment record). */
  allowedClassIds: Readonly<Record<KeyedContract, readonly string[]>>;
  /** Token addresses the receiver accepts. */
  allowedTokens: readonly string[];
  /** The receiver's Aztec address. */
  me: string;
  /** The Aztec address of the conversation peer the message came from. */
  peer: string;
}

export type VerifyResult = { ok: true; invite: AgreementInvite } | { ok: false; reason: string };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Parses and verifies a received invitation. Never throws on bad input. */
export async function verifyAgreementInvite(raw: string, o: VerifyOptions): Promise<VerifyResult> {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_INVITE_BYTES) {
    return { ok: false, reason: 'invitation too large' };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invitation is not JSON' };
  }
  const parsed = AgreementInviteSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: 'malformed invitation' };
  const inv = parsed.data;
  const kind = kindOf(inv);

  if (!same(inv.recipient, o.me)) return { ok: false, reason: 'invitation is not addressed to you' };
  if (!same(inv.sender, o.peer)) return { ok: false, reason: 'invitation does not come from this conversation' };
  if (same(inv.sender, inv.recipient)) return { ok: false, reason: 'sender and recipient are the same' };
  if (!o.allowedTokens.some((t) => same(t, inv.token))) return { ok: false, reason: 'token not accepted' };
  if (!o.allowedClassIds[kind].some((c) => same(c, inv.classId))) return { ok: false, reason: 'contract class not recognised' };

  const { instance } = await computeKeyedInstance(o.artifacts[kind], {
    secretKey: Fr.fromString(inv.contractSecret),
    salt: Fr.fromString(inv.salt),
    token: AztecAddress.fromStringUnsafe(inv.token),
  });
  if (!same(instance.currentContractClassId.toString(), inv.classId)) {
    return { ok: false, reason: 'artifact does not produce the claimed class' };
  }
  if (!same(instance.address.toString(), inv.instanceAddress)) {
    return { ok: false, reason: 'address does not match the shared secret' };
  }
  return { ok: true, invite: inv };
}

/** Class IDs the deployment record marks as current, per kind. */
export function currentClassIds(record: {
  contracts: Array<{ name: string; classId: string; tracksCurrentArtifact?: boolean }>;
}): Record<KeyedContract, string[]> {
  const pick = (prefix: string) =>
    [...new Set(record.contracts.filter((c) => c.tracksCurrentArtifact && c.name.startsWith(prefix)).map((c) => c.classId))];
  return { escrow: pick('PrivateEscrow'), streams: pick('PaymentStream') };
}
