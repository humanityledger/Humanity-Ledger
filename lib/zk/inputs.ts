/**
 * lib/zk/inputs.ts
 *
 * Input validation for the Noir circuits (master prompt rules 1 and 2):
 * strings or bigints only, Field inputs in [0, r), integers within their Noir
 * type. Errors name the input, never its value. Browser-safe: shared by
 * lib/zk/prover.ts (Node) and lib/zk/browser-prover.ts (Web Worker).
 */

/** BN254 scalar field modulus r. */
export const BN254_SCALAR_MODULUS = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);

export const U64_MAX = (BigInt(1) << BigInt(64)) - BigInt(1);
export const U32_MAX = (BigInt(1) << BigInt(32)) - BigInt(1);

/** Accepted input type: decimal or 0x-hex string, or bigint. */
export type ZkInput = string | bigint;

function toBigInt(value: unknown, name: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string' && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  if (typeof value === 'number') {
    throw new TypeError(`[ZK PROVER] Input "${name}" must be a string or bigint, not a number.`);
  }
  throw new TypeError(`[ZK PROVER] Input "${name}" is not a decimal or 0x-hex integer.`);
}

/** Validates a Field input and returns it as 0x-hex. */
export function validateFieldElement(value: unknown, name: string): string {
  const v = toBigInt(value, name);
  if (v < BigInt(0) || v >= BN254_SCALAR_MODULUS) {
    throw new RangeError(`[ZK PROVER] Input "${name}" is outside the BN254 scalar field.`);
  }
  return '0x' + v.toString(16);
}

/** Validates an unsigned integer input against its Noir bit width. */
export function validateUnsigned(value: unknown, name: string, max: bigint = U64_MAX): string {
  const v = toBigInt(value, name);
  if (v < BigInt(0) || v > max) {
    throw new RangeError(`[ZK PROVER] Input "${name}" is outside the range of its integer type.`);
  }
  return v.toString(10);
}

export interface EscrowWitness {
  sender_secret: ZkInput;
  recipient_pubkey: ZkInput;
  amount: ZkInput;
  salt: ZkInput;
  escrow_commitment: ZkInput;
  nullifier: ZkInput;
  deadline: ZkInput;
  current_timestamp: ZkInput;
}

export interface IdentityWitness {
  identity_secret: ZkInput;
  jurisdiction_code: ZkInput;
  merkle_leaf_sibling: ZkInput;
  is_left: boolean;
  expected_merkle_root: ZkInput;
  scope: ZkInput;
  scoped_nullifier: ZkInput;
}

export interface StreamsWitness {
  sender_secret: ZkInput;
  recipient_pubkey: ZkInput;
  total_allocation: ZkInput;
  rate_per_second: ZkInput;
  start_time: ZkInput;
  withdrawn_amount: ZkInput;
  claim_amount: ZkInput;
  salt: ZkInput;
  stream_commitment: ZkInput;
  current_time: ZkInput;
  stream_nullifier: ZkInput;
}

export type CircuitInputs = Record<string, string | boolean>;

/** Validated `nargo` inputs of the escrow circuit. */
export function escrowInputs(w: EscrowWitness): CircuitInputs {
  return {
    sender_secret: validateFieldElement(w.sender_secret, 'sender_secret'),
    recipient_pubkey: validateFieldElement(w.recipient_pubkey, 'recipient_pubkey'),
    amount: validateUnsigned(w.amount, 'amount'),
    salt: validateFieldElement(w.salt, 'salt'),
    escrow_commitment: validateFieldElement(w.escrow_commitment, 'escrow_commitment'),
    nullifier: validateFieldElement(w.nullifier, 'nullifier'),
    deadline: validateUnsigned(w.deadline, 'deadline'),
    current_timestamp: validateUnsigned(w.current_timestamp, 'current_timestamp'),
  };
}

/** Validated `nargo` inputs of the identity circuit. */
export function identityInputs(w: IdentityWitness): CircuitInputs {
  if (typeof w.is_left !== 'boolean') {
    throw new TypeError('[ZK PROVER] Input "is_left" must be a boolean.');
  }
  return {
    identity_secret: validateFieldElement(w.identity_secret, 'identity_secret'),
    jurisdiction_code: validateUnsigned(w.jurisdiction_code, 'jurisdiction_code', U32_MAX),
    merkle_leaf_sibling: validateFieldElement(w.merkle_leaf_sibling, 'merkle_leaf_sibling'),
    is_left: w.is_left,
    expected_merkle_root: validateFieldElement(w.expected_merkle_root, 'expected_merkle_root'),
    scope: validateFieldElement(w.scope, 'scope'),
    scoped_nullifier: validateFieldElement(w.scoped_nullifier, 'scoped_nullifier'),
  };
}

/** Validated `nargo` inputs of the streams circuit. */
export function streamsInputs(w: StreamsWitness): CircuitInputs {
  return {
    sender_secret: validateFieldElement(w.sender_secret, 'sender_secret'),
    recipient_pubkey: validateFieldElement(w.recipient_pubkey, 'recipient_pubkey'),
    total_allocation: validateUnsigned(w.total_allocation, 'total_allocation'),
    rate_per_second: validateUnsigned(w.rate_per_second, 'rate_per_second'),
    start_time: validateUnsigned(w.start_time, 'start_time'),
    withdrawn_amount: validateUnsigned(w.withdrawn_amount, 'withdrawn_amount'),
    claim_amount: validateUnsigned(w.claim_amount, 'claim_amount'),
    salt: validateFieldElement(w.salt, 'salt'),
    stream_commitment: validateFieldElement(w.stream_commitment, 'stream_commitment'),
    current_time: validateUnsigned(w.current_time, 'current_time'),
    stream_nullifier: validateFieldElement(w.stream_nullifier, 'stream_nullifier'),
  };
}
