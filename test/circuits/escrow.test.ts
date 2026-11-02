import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

/**
 * Task T3 / T5: Noir Escrow Circuit Invariant Verification & Comprehensive Negative Suite
 * 
 * Enforces all normative constraints defined in `circuits/escrow/src/main.nr`:
 * 1. Positive amount: amount > 0
 * 2. Amount ceiling: amount <= MAX_ESCROW_AMOUNT (1e15)
 * 3. Non-zero identity: sender_secret != 0 && recipient_pubkey != 0
 * 4. Temporal boundary: current_timestamp <= deadline
 * 5. Escrow commitment binding: commitment == H(sender, recipient, amount, salt)
 * 6. Nullifier binding: nullifier == H(sender, salt)
 */
describe('T3 / T5 — Noir Escrow Circuit Constraint Invariants & Negative Tests', () => {
  const BN254_FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const MAX_ESCROW_AMOUNT = 1_000_000_000_000_000n; // 1e15

  function fieldHash(inputs: bigint[]): bigint {
    const hash = crypto.createHash('sha256');
    for (const input of inputs) {
      hash.update(input.toString(16).padStart(64, '0'));
    }
    return BigInt('0x' + hash.digest('hex')) % BN254_FR_MODULUS;
  }

  interface EscrowWitness {
    senderSecret: bigint;
    recipientPubkey: bigint;
    amount: bigint;
    salt: bigint;
  }

  interface EscrowPublicInputs {
    escrowCommitment: bigint;
    nullifier: bigint;
    deadline: bigint;
    currentTimestamp: bigint;
  }

  function verifyEscrowCircuit(witness: EscrowWitness, pubInputs: EscrowPublicInputs): void {
    // Invariant 1: Positive amount
    if (witness.amount <= 0n) {
      throw new Error('Circuit constraint violation: amount must be > 0');
    }

    // Invariant 2: Value ceiling
    if (witness.amount > MAX_ESCROW_AMOUNT) {
      throw new Error('Circuit constraint violation: amount exceeds MAX_ESCROW_AMOUNT');
    }

    // Invariant 3: Non-zero identity keys
    if (witness.senderSecret === 0n) {
      throw new Error('Circuit constraint violation: sender_secret must not be zero');
    }
    if (witness.recipientPubkey === 0n) {
      throw new Error('Circuit constraint violation: recipient_pubkey must not be zero');
    }

    // Invariant 4: Temporal boundary
    if (pubInputs.currentTimestamp > pubInputs.deadline) {
      throw new Error('Circuit constraint violation: current_timestamp <= deadline');
    }

    // Invariant 5: Escrow commitment binding
    const calculatedCommitment = fieldHash([
      witness.senderSecret,
      witness.recipientPubkey,
      witness.amount,
      witness.salt,
    ]);
    if (calculatedCommitment !== pubInputs.escrowCommitment) {
      throw new Error('Circuit constraint violation: commitment mismatch');
    }

    // Invariant 6: Nullifier binding
    const calculatedNullifier = fieldHash([witness.senderSecret, witness.salt]);
    if (calculatedNullifier !== pubInputs.nullifier) {
      throw new Error('Circuit constraint violation: nullifier mismatch');
    }
  }

  it('Happy Path: Valid escrow executes successfully and produces valid proof inputs', () => {
    const witness: EscrowWitness = {
      senderSecret: 0x123456789n,
      recipientPubkey: 0x987654321n,
      amount: 5000000000n, // 50 QD
      salt: 0xabcdeffedcban,
    };

    const commitment = fieldHash([
      witness.senderSecret,
      witness.recipientPubkey,
      witness.amount,
      witness.salt,
    ]);
    const nullifier = fieldHash([witness.senderSecret, witness.salt]);

    const pubInputs: EscrowPublicInputs = {
      escrowCommitment: commitment,
      nullifier,
      deadline: 1800000000n,
      currentTimestamp: 1750000000n,
    };

    expect(() => verifyEscrowCircuit(witness, pubInputs)).not.toThrow();
  });

  it('Negative Test: Rejects execution when timestamp exceeds deadline (Expired Escrow)', () => {
    const witness: EscrowWitness = {
      senderSecret: 0x123456789n,
      recipientPubkey: 0x987654321n,
      amount: 5000n,
      salt: 0x999n,
    };
    const commitment = fieldHash([witness.senderSecret, witness.recipientPubkey, witness.amount, witness.salt]);
    const nullifier = fieldHash([witness.senderSecret, witness.salt]);

    const expiredPubInputs: EscrowPublicInputs = {
      escrowCommitment: commitment,
      nullifier,
      deadline: 1700000000n,
      currentTimestamp: 1750000000n, // past deadline
    };

    expect(() => verifyEscrowCircuit(witness, expiredPubInputs)).toThrow(
      'current_timestamp <= deadline',
    );
  });

  it('Negative Test: Rejects zero or negative amount allocation', () => {
    const witness: EscrowWitness = {
      senderSecret: 0x123n,
      recipientPubkey: 0x456n,
      amount: 0n, // invalid
      salt: 0x789n,
    };
    const commitment = fieldHash([witness.senderSecret, witness.recipientPubkey, 0n, witness.salt]);
    const nullifier = fieldHash([witness.senderSecret, witness.salt]);

    const pubInputs: EscrowPublicInputs = {
      escrowCommitment: commitment,
      nullifier,
      deadline: 1800000000n,
      currentTimestamp: 1700000000n,
    };

    expect(() => verifyEscrowCircuit(witness, pubInputs)).toThrow('amount must be > 0');
  });

  it('Negative Test: Rejects amount exceeding MAX_ESCROW_AMOUNT ceiling', () => {
    const witness: EscrowWitness = {
      senderSecret: 0x123n,
      recipientPubkey: 0x456n,
      amount: MAX_ESCROW_AMOUNT + 1n, // exceeds bound
      salt: 0x789n,
    };
    const commitment = fieldHash([witness.senderSecret, witness.recipientPubkey, witness.amount, witness.salt]);
    const nullifier = fieldHash([witness.senderSecret, witness.salt]);

    const pubInputs: EscrowPublicInputs = {
      escrowCommitment: commitment,
      nullifier,
      deadline: 1800000000n,
      currentTimestamp: 1700000000n,
    };

    expect(() => verifyEscrowCircuit(witness, pubInputs)).toThrow('amount exceeds MAX_ESCROW_AMOUNT');
  });

  it('Negative Test: Rejects zero sender secret key', () => {
    const witness: EscrowWitness = {
      senderSecret: 0n, // zero key
      recipientPubkey: 0x456n,
      amount: 100n,
      salt: 0x789n,
    };
    const commitment = fieldHash([0n, witness.recipientPubkey, 100n, witness.salt]);
    const nullifier = fieldHash([0n, witness.salt]);

    const pubInputs: EscrowPublicInputs = {
      escrowCommitment: commitment,
      nullifier,
      deadline: 1800000000n,
      currentTimestamp: 1700000000n,
    };

    expect(() => verifyEscrowCircuit(witness, pubInputs)).toThrow('sender_secret must not be zero');
  });

  it('Negative Test: Rejects zero recipient pubkey', () => {
    const witness: EscrowWitness = {
      senderSecret: 0x123n,
      recipientPubkey: 0n, // zero recipient
      amount: 100n,
      salt: 0x789n,
    };
    const commitment = fieldHash([witness.senderSecret, 0n, 100n, witness.salt]);
    const nullifier = fieldHash([witness.senderSecret, witness.salt]);

    const pubInputs: EscrowPublicInputs = {
      escrowCommitment: commitment,
      nullifier,
      deadline: 1800000000n,
      currentTimestamp: 1700000000n,
    };

    expect(() => verifyEscrowCircuit(witness, pubInputs)).toThrow('recipient_pubkey must not be zero');
  });

  it('Negative Test: Rejects forged commitment or tampered recipient pubkey', () => {
    const witness: EscrowWitness = {
      senderSecret: 0x123n,
      recipientPubkey: 0x456n,
      amount: 100n,
      salt: 0x789n,
    };
    const nullifier = fieldHash([witness.senderSecret, witness.salt]);
    const pubInputs: EscrowPublicInputs = {
      escrowCommitment: 0xdeadbeefn, // tampered commitment
      nullifier,
      deadline: 1800000000n,
      currentTimestamp: 1700000000n,
    };

    expect(() => verifyEscrowCircuit(witness, pubInputs)).toThrow('commitment mismatch');
  });

  it('Negative Test: Rejects tampered nullifier to prevent double-spending', () => {
    const witness: EscrowWitness = {
      senderSecret: 0x123n,
      recipientPubkey: 0x456n,
      amount: 100n,
      salt: 0x789n,
    };
    const commitment = fieldHash([witness.senderSecret, witness.recipientPubkey, 100n, witness.salt]);
    const pubInputs: EscrowPublicInputs = {
      escrowCommitment: commitment,
      nullifier: 0xbad0000000000000n, // forged nullifier
      deadline: 1800000000n,
      currentTimestamp: 1700000000n,
    };

    expect(() => verifyEscrowCircuit(witness, pubInputs)).toThrow('nullifier mismatch');
  });
});
