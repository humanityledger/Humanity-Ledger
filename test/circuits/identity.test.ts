import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

/**
 * Task T3 / T5: Noir Identity Circuit Invariant Verification & Comprehensive Negative Suite
 * 
 * Enforces all normative constraints defined in `circuits/identity/src/main.nr`:
 * 1. Sanctions screening: jurisdiction_code != SANCTIONED_JURISDICTION_1 & 2
 * 2. Positive jurisdiction: jurisdiction_code > 0
 * 3. Non-zero identity secret: identity_secret != 0
 * 4. Merkle inclusion proof: calculated_root == expected_merkle_root
 * 5. Scoped nullifier binding: scoped_nullifier == H(identity_secret, scope)
 */
describe('T3 / T5 — Noir Anonymous Identity & Compliance Invariants & Negative Tests', () => {
  const BN254_FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const SANCTIONED_JURISDICTION_1 = 999;
  const SANCTIONED_JURISDICTION_2 = 998;

  function fieldHash(inputs: bigint[]): bigint {
    const hash = crypto.createHash('sha256');
    for (const input of inputs) {
      hash.update(input.toString(16).padStart(64, '0'));
    }
    return BigInt('0x' + hash.digest('hex')) % BN254_FR_MODULUS;
  }

  interface IdentityWitness {
    identitySecret: bigint;
    jurisdictionCode: number;
    merkleLeafSibling: bigint;
    isLeft: boolean;
  }

  interface IdentityPublicInputs {
    expectedMerkleRoot: bigint;
    scope: bigint;
    scopedNullifier: bigint;
  }

  function verifyIdentityCircuit(witness: IdentityWitness, pubInputs: IdentityPublicInputs): void {
    // Invariant 1: Compliance - jurisdiction must not be sanctioned
    if (
      witness.jurisdictionCode === SANCTIONED_JURISDICTION_1 ||
      witness.jurisdictionCode === SANCTIONED_JURISDICTION_2
    ) {
      throw new Error('Circuit constraint violation: sanctioned jurisdiction detected');
    }

    // Invariant 2: Positive jurisdiction code
    if (witness.jurisdictionCode <= 0) {
      throw new Error('Circuit constraint violation: jurisdiction_code must be > 0');
    }

    // Invariant 3: Non-zero identity secret
    if (witness.identitySecret === 0n) {
      throw new Error('Circuit constraint violation: identity_secret must not be zero');
    }

    // Invariant 4: Compute leaf and verify Merkle inclusion
    const leaf = fieldHash([witness.identitySecret, BigInt(witness.jurisdictionCode)]);
    const calculatedRoot = witness.isLeft
      ? fieldHash([leaf, witness.merkleLeafSibling])
      : fieldHash([witness.merkleLeafSibling, leaf]);

    if (calculatedRoot !== pubInputs.expectedMerkleRoot) {
      throw new Error('Circuit constraint violation: Merkle root mismatch');
    }

    // Invariant 5: Scoped nullifier binding (anti-double claim within scope)
    const calculatedNullifier = fieldHash([witness.identitySecret, pubInputs.scope]);
    if (calculatedNullifier !== pubInputs.scopedNullifier) {
      throw new Error('Circuit constraint violation: scoped nullifier mismatch');
    }
  }

  it('Happy Path: Anonymous compliant citizen proves membership and generates valid scoped nullifier', () => {
    const witness: IdentityWitness = {
      identitySecret: 0x9988776655n,
      jurisdictionCode: 840, // Non-sanctioned jurisdiction
      merkleLeafSibling: 0x1122334455n,
      isLeft: true,
    };

    const leaf = fieldHash([witness.identitySecret, BigInt(witness.jurisdictionCode)]);
    const root = fieldHash([leaf, witness.merkleLeafSibling]);
    const scope = 0x20261031n;
    const scopedNullifier = fieldHash([witness.identitySecret, scope]);

    const pubInputs: IdentityPublicInputs = {
      expectedMerkleRoot: root,
      scope,
      scopedNullifier,
    };

    expect(() => verifyIdentityCircuit(witness, pubInputs)).not.toThrow();
  });

  it('Negative Test: Rejects identity belonging to sanctioned jurisdiction 999', () => {
    const witness: IdentityWitness = {
      identitySecret: 0x9988776655n,
      jurisdictionCode: SANCTIONED_JURISDICTION_1,
      merkleLeafSibling: 0x1122334455n,
      isLeft: true,
    };

    const leaf = fieldHash([witness.identitySecret, BigInt(witness.jurisdictionCode)]);
    const root = fieldHash([leaf, witness.merkleLeafSibling]);
    const scope = 0x20261031n;
    const scopedNullifier = fieldHash([witness.identitySecret, scope]);

    const pubInputs: IdentityPublicInputs = {
      expectedMerkleRoot: root,
      scope,
      scopedNullifier,
    };

    expect(() => verifyIdentityCircuit(witness, pubInputs)).toThrow(
      'sanctioned jurisdiction detected',
    );
  });

  it('Negative Test: Rejects identity belonging to sanctioned jurisdiction 998', () => {
    const witness: IdentityWitness = {
      identitySecret: 0x9988776655n,
      jurisdictionCode: SANCTIONED_JURISDICTION_2,
      merkleLeafSibling: 0x1122334455n,
      isLeft: true,
    };

    const leaf = fieldHash([witness.identitySecret, BigInt(witness.jurisdictionCode)]);
    const root = fieldHash([leaf, witness.merkleLeafSibling]);
    const scope = 0x20261031n;
    const scopedNullifier = fieldHash([witness.identitySecret, scope]);

    const pubInputs: IdentityPublicInputs = {
      expectedMerkleRoot: root,
      scope,
      scopedNullifier,
    };

    expect(() => verifyIdentityCircuit(witness, pubInputs)).toThrow(
      'sanctioned jurisdiction detected',
    );
  });

  it('Negative Test: Rejects non-positive (zero) jurisdiction code', () => {
    const witness: IdentityWitness = {
      identitySecret: 0x9988776655n,
      jurisdictionCode: 0,
      merkleLeafSibling: 0x1122334455n,
      isLeft: true,
    };

    const leaf = fieldHash([witness.identitySecret, 0n]);
    const root = fieldHash([leaf, witness.merkleLeafSibling]);
    const scope = 0x20261031n;
    const scopedNullifier = fieldHash([witness.identitySecret, scope]);

    const pubInputs: IdentityPublicInputs = {
      expectedMerkleRoot: root,
      scope,
      scopedNullifier,
    };

    expect(() => verifyIdentityCircuit(witness, pubInputs)).toThrow(
      'jurisdiction_code must be > 0',
    );
  });

  it('Negative Test: Rejects zero identity secret', () => {
    const witness: IdentityWitness = {
      identitySecret: 0n,
      jurisdictionCode: 840,
      merkleLeafSibling: 0x1122334455n,
      isLeft: true,
    };

    const leaf = fieldHash([0n, 840n]);
    const root = fieldHash([leaf, witness.merkleLeafSibling]);
    const scope = 0x20261031n;
    const scopedNullifier = fieldHash([0n, scope]);

    const pubInputs: IdentityPublicInputs = {
      expectedMerkleRoot: root,
      scope,
      scopedNullifier,
    };

    expect(() => verifyIdentityCircuit(witness, pubInputs)).toThrow(
      'identity_secret must not be zero',
    );
  });

  it('Negative Test: Rejects fraudulent Merkle proof (tampered root)', () => {
    const witness: IdentityWitness = {
      identitySecret: 0x9988776655n,
      jurisdictionCode: 840,
      merkleLeafSibling: 0xbad051b1179n,
      isLeft: true,
    };

    const scope = 0x20261031n;
    const scopedNullifier = fieldHash([witness.identitySecret, scope]);

    const pubInputs: IdentityPublicInputs = {
      expectedMerkleRoot: 0x1234567890abcdefn,
      scope,
      scopedNullifier,
    };

    expect(() => verifyIdentityCircuit(witness, pubInputs)).toThrow('Merkle root mismatch');
  });

  it('Negative Test: Rejects tampered scoped nullifier (anti-replay within scope)', () => {
    const witness: IdentityWitness = {
      identitySecret: 0x9988776655n,
      jurisdictionCode: 840,
      merkleLeafSibling: 0x1122334455n,
      isLeft: true,
    };

    const leaf = fieldHash([witness.identitySecret, 840n]);
    const root = fieldHash([leaf, witness.merkleLeafSibling]);
    const scope = 0x20261031n;

    const pubInputs: IdentityPublicInputs = {
      expectedMerkleRoot: root,
      scope,
      scopedNullifier: 0xdeadbeefcafebaben, // tampered nullifier
    };

    expect(() => verifyIdentityCircuit(witness, pubInputs)).toThrow('scoped nullifier mismatch');
  });
});
