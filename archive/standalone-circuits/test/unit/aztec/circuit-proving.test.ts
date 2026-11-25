/**
 * test/unit/aztec/circuit-proving.test.ts
 *
 * Real UltraHonk proving for the three experimental standalone circuits
 * (escrow, identity, streams): ACIR execution with noir_js, proof generation and
 * verification with Barretenberg, and the constraint violations each circuit
 * rejects. Each case proves a single action in isolation; the circuits have
 * known soundness issues across actions (docs/zk/MASTER_PROMPT.md, ZK-01..ZK-07).
 */

import { describe, it, expect, afterAll } from 'vitest';
import {
  proveEscrow,
  proveIdentity,
  proveStreams,
  verifyProof,
  destroyZkEngine,
  type EscrowWitness,
  type IdentityWitness,
  type StreamsWitness,
} from '../../../lib/zk/prover';

describe('UltraHonk proving for the standalone Noir circuits', () => {
  afterAll(async () => {
    await destroyZkEngine();
  });

  // ─── 1. ESCROW CIRCUIT ──────────────────────────────────────────────────────

  describe('Private Escrow Release Circuit (zk_escrow)', () => {
    const validEscrowWitness: EscrowWitness = {
      sender_secret: '12345',
      recipient_pubkey: '67890',
      amount: '1000',
      salt: '999',
      escrow_commitment: '0x1d73346def6ef00fe9c6e6165cbdebcd739d1b43ea7f025529c040d4843080a5',
      nullifier: '0x1485a879df7717201348b608c7af55d2c6a630ff8ae6f05181d80d6f315b8f2a',
      deadline: '1800000000',
      current_timestamp: '1750000000',
    };

    it('generates and verifies a real UltraHonk proof for valid escrow release', async () => {
      const result = await proveEscrow(validEscrowWitness);

      expect(result.circuit).toBe('escrow');
      expect(result.isValid).toBe(true);
      expect(result.proof).toBeInstanceOf(Uint8Array);
      expect(result.proof.length).toBeGreaterThan(10000); // UltraHonk proof is ~14KB
      expect(result.publicInputs).toHaveLength(4);
      expect(result.vkHash).toBe('0x4e3cc4c8ce03607dcb2b98bd50c0d31084300634ee8f70f4674919682eb915c2');
    }, 120000);

    it('rejects an escrow with tampered commitment (preimage binding invariant)', async () => {
      const invalidWitness: EscrowWitness = {
        ...validEscrowWitness,
        escrow_commitment: '0xdeadbeef',
      };

      await expect(proveEscrow(invalidWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);

    it('rejects an escrow when deadline has expired (temporal boundary invariant)', async () => {
      const expiredWitness: EscrowWitness = {
        ...validEscrowWitness,
        current_timestamp: '1800000001', // 1 second past deadline 1800000000
      };

      await expect(proveEscrow(expiredWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);

    it('rejects an escrow with zero amount (positive amount invariant)', async () => {
      const zeroAmountWitness: EscrowWitness = {
        ...validEscrowWitness,
        amount: '0',
      };

      await expect(proveEscrow(zeroAmountWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);

    it('rejects an escrow exceeding MAX_ESCROW_AMOUNT (value ceiling invariant)', async () => {
      const excessiveWitness: EscrowWitness = {
        ...validEscrowWitness,
        amount: '1000000000000001', // MAX_ESCROW_AMOUNT + 1
      };

      await expect(proveEscrow(excessiveWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);

    it('fails verification if public inputs or proof bytes are tampered (cryptographic soundness)', async () => {
      const result = await proveEscrow(validEscrowWitness);

      // 1. Tampered public inputs must fail verification
      const forgedPublicInputs = [...result.publicInputs];
      forgedPublicInputs[0] = '0x00000000000000000000000000000000000000000000000000000000deadbeef';
      const isPublicTamperedValid = await verifyProof('escrow', {
        proof: result.proof,
        publicInputs: forgedPublicInputs,
      });
      expect(isPublicTamperedValid).toBe(false);

      // 2. Corrupted proof bytes must safely fail verification
      const tamperedProofBytes = new Uint8Array(result.proof);
      tamperedProofBytes[20] ^= 0xaa;
      const isProofTamperedValid = await verifyProof('escrow', {
        proof: tamperedProofBytes,
        publicInputs: result.publicInputs,
      });
      expect(isProofTamperedValid).toBe(false);
    }, 120000);
  });

  // ─── 2. IDENTITY CIRCUIT ────────────────────────────────────────────────────

  describe('Anonymous Identity & Compliance Circuit (zk_identity)', () => {
    const validIdentityWitness: IdentityWitness = {
      identity_secret: '12345',
      jurisdiction_code: '840', // Non-sanctioned
      merkle_leaf_sibling: '67890',
      is_left: true,
      expected_merkle_root: '0x2a65b513ce830604250f5cb08ce7a88129aad8d03e1bb2742b625b22020cbd94',
      scope: '42',
      scoped_nullifier: '0x1a8fc5ddd747d00a29190989f1034e8687f254fb13286c425e8c72ba0233ab95',
    };

    it('generates and verifies a real UltraHonk proof for anonymous compliant identity', async () => {
      const result = await proveIdentity(validIdentityWitness);

      expect(result.circuit).toBe('identity');
      expect(result.isValid).toBe(true);
      expect(result.proof.length).toBeGreaterThan(10000);
      expect(result.publicInputs).toHaveLength(3);
      expect(result.vkHash).toBe('0xcd02d2407de202d61e1a03c360633a9b0cdd8fe4b4d67b007cce108990632194');
    }, 120000);

    it('rejects identity from SANCTIONED_JURISDICTION_1 (999)', async () => {
      const sanctionedWitness: IdentityWitness = {
        ...validIdentityWitness,
        jurisdiction_code: '999',
      };

      await expect(proveIdentity(sanctionedWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);

    it('rejects identity from SANCTIONED_JURISDICTION_2 (998)', async () => {
      const sanctionedWitness: IdentityWitness = {
        ...validIdentityWitness,
        jurisdiction_code: '998',
      };

      await expect(proveIdentity(sanctionedWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);

    it('rejects identity with zero identity secret', async () => {
      const zeroSecretWitness: IdentityWitness = {
        ...validIdentityWitness,
        identity_secret: '0',
      };

      await expect(proveIdentity(zeroSecretWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);

    it('rejects identity with tampered Merkle root', async () => {
      const tamperedRootWitness: IdentityWitness = {
        ...validIdentityWitness,
        expected_merkle_root: '0xdeadbeef',
      };

      await expect(proveIdentity(tamperedRootWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);
  });

  // ─── 3. STREAMS CIRCUIT ─────────────────────────────────────────────────────

  describe('Continuous Payment Stream Circuit (zk_streams)', () => {
    const validStreamsWitness: StreamsWitness = {
      sender_secret: '12345',
      recipient_pubkey: '67890',
      total_allocation: '10000',
      rate_per_second: '10',
      start_time: '1000',
      withdrawn_amount: '200',
      claim_amount: '300',
      salt: '999',
      stream_commitment: '0x1dd07dd799d46a7e7fd63ba40116b21fb43535c17177d811bda7f771aaece6d9',
      current_time: '1060',
      stream_nullifier: '0x13f5958db040e7cd4d94916477e781197eab5361b87b8894c4670b0865ad97cc',
    };

    it('generates and verifies a real UltraHonk proof for payment stream withdrawal', async () => {
      const result = await proveStreams(validStreamsWitness);

      expect(result.circuit).toBe('streams');
      expect(result.isValid).toBe(true);
      expect(result.proof.length).toBeGreaterThan(10000);
      expect(result.publicInputs).toHaveLength(3);
      expect(result.vkHash).toBe('0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346');
    }, 120000);

    it('rejects stream claim before start time (temporal monotonicity)', async () => {
      const beforeStartWitness: StreamsWitness = {
        ...validStreamsWitness,
        current_time: '999', // before start_time 1000
      };

      await expect(proveStreams(beforeStartWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);

    it('rejects stream claim exceeding accrued capacity', async () => {
      const overAccruedWitness: StreamsWitness = {
        ...validStreamsWitness,
        claim_amount: '5000', // (200 + 5000) > (60 * 10 = 600)
      };

      await expect(proveStreams(overAccruedWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);

    it('rejects stream claim exceeding total allocation', async () => {
      const overAllocWitness: StreamsWitness = {
        ...validStreamsWitness,
        total_allocation: '400', // (200 + 300) = 500 > 400
      };

      await expect(proveStreams(overAllocWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);

    it('rejects stream with rate exceeding MAX_RATE (overflow protection)', async () => {
      const overRateWitness: StreamsWitness = {
        ...validStreamsWitness,
        rate_per_second: '1000000000000001', // > 1e15
      };

      await expect(proveStreams(overRateWitness)).rejects.toThrow(/Cannot satisfy constraint/i);
    }, 60000);
  });
});
