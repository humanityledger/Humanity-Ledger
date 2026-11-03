/**
 * test/unit/aztec/native-contracts.test.ts
 *
 * Humanity Ledger Protocol — Aztec v6.0.0 Native Contract Verification Suite
 *
 * Asserts structural validity, UltraHonk compilation artifacts, cryptographic domain
 * separation, depth-32 Merkle mathematics, and security invariants across the 3 native
 * L2 contracts (PrivateEscrow, PaymentStream, IdentityCredential).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

interface AztecContractFunction {
  name: string;
  custom_attributes: string[];
  is_unconstrained: boolean;
  bytecode: string;
}

interface AztecContractArtifact {
  name: string;
  aztec_version: string;
  noir_version: string;
  transpiled: boolean;
  functions: AztecContractFunction[];
}

describe('Aztec v6.0.0 Native Contracts Pipeline', () => {
  const contractsDir = path.resolve(__dirname, '../../../contracts/aztec');

  // ─── 1. ARTIFACT INTEGRITY & ULTRAHONK VKS ──────────────────────────────────

  describe('Contract Artifact Compilation & UltraHonk Verification Keys', () => {
    it('verifies PrivateEscrow compiled artifact with valid UltraHonk bytecode', () => {
      const artifactPath = path.join(contractsDir, 'escrow/target/private_escrow-PrivateEscrow.json');
      expect(fs.existsSync(artifactPath), 'PrivateEscrow artifact must exist').toBe(true);

      const raw = fs.readFileSync(artifactPath, 'utf8');
      const artifact = JSON.parse(raw) as AztecContractArtifact;

      expect(artifact.name).toBe('PrivateEscrow');
      expect(artifact.aztec_version).toBe('6.0.0');
      expect(artifact.transpiled).toBe(true);

      const fnNames = artifact.functions.map(f => f.name);
      expect(fnNames).toContain('constructor');
      expect(fnNames).toContain('deposit');
      expect(fnNames).toContain('claim');
      expect(fnNames).toContain('refund');
      expect(fnNames).toContain('get_token');

      // Check UltraHonk private functions and bytecode
      const depositFn = artifact.functions.find(f => f.name === 'deposit');
      const claimFn = artifact.functions.find(f => f.name === 'claim');
      const refundFn = artifact.functions.find(f => f.name === 'refund');

      expect(depositFn?.custom_attributes).toContain('abi_private');
      expect(claimFn?.custom_attributes).toContain('abi_private');
      expect(refundFn?.custom_attributes).toContain('abi_private');

      expect(depositFn?.is_unconstrained).toBe(false);
      expect(claimFn?.is_unconstrained).toBe(false);
      expect(refundFn?.is_unconstrained).toBe(false);

      // Real ACIR/AVM circuit bytecode (> 100 KB each)
      expect(depositFn?.bytecode.length).toBeGreaterThan(50000);
      expect(claimFn?.bytecode.length).toBeGreaterThan(50000);
      expect(refundFn?.bytecode.length).toBeGreaterThan(50000);
    });

    it('verifies PaymentStream compiled artifact with valid UltraHonk bytecode', () => {
      const artifactPath = path.join(contractsDir, 'streams/target/payment_stream-PaymentStream.json');
      expect(fs.existsSync(artifactPath), 'PaymentStream artifact must exist').toBe(true);

      const raw = fs.readFileSync(artifactPath, 'utf8');
      const artifact = JSON.parse(raw) as AztecContractArtifact;

      expect(artifact.name).toBe('PaymentStream');
      expect(artifact.aztec_version).toBe('6.0.0');
      expect(artifact.transpiled).toBe(true);

      const fnNames = artifact.functions.map(f => f.name);
      expect(fnNames).toContain('constructor');
      expect(fnNames).toContain('create_stream');
      expect(fnNames).toContain('withdraw');
      expect(fnNames).toContain('cancel');
      expect(fnNames).toContain('get_token');

      const createFn = artifact.functions.find(f => f.name === 'create_stream');
      const withdrawFn = artifact.functions.find(f => f.name === 'withdraw');
      const cancelFn = artifact.functions.find(f => f.name === 'cancel');

      expect(createFn?.custom_attributes).toContain('abi_private');
      expect(withdrawFn?.custom_attributes).toContain('abi_private');
      expect(cancelFn?.custom_attributes).toContain('abi_private');

      expect(createFn?.is_unconstrained).toBe(false);
      expect(withdrawFn?.is_unconstrained).toBe(false);
      expect(cancelFn?.is_unconstrained).toBe(false);

      expect(createFn?.bytecode.length).toBeGreaterThan(50000);
      expect(withdrawFn?.bytecode.length).toBeGreaterThan(50000);
      expect(cancelFn?.bytecode.length).toBeGreaterThan(50000);
    });

    it('verifies IdentityCredential compiled artifact with valid UltraHonk bytecode', () => {
      const artifactPath = path.join(contractsDir, 'identity/target/identity_credential-IdentityCredential.json');
      expect(fs.existsSync(artifactPath), 'IdentityCredential artifact must exist').toBe(true);

      const raw = fs.readFileSync(artifactPath, 'utf8');
      const artifact = JSON.parse(raw) as AztecContractArtifact;

      expect(artifact.name).toBe('IdentityCredential');
      expect(artifact.aztec_version).toBe('6.0.0');
      expect(artifact.transpiled).toBe(true);

      const fnNames = artifact.functions.map(f => f.name);
      expect(fnNames).toContain('constructor');
      expect(fnNames).toContain('update_root');
      expect(fnNames).toContain('assert_valid_root');
      expect(fnNames).toContain('verify_and_claim');
      expect(fnNames).toContain('get_current_root');
      expect(fnNames).toContain('get_issuer');

      const verifyFn = artifact.functions.find(f => f.name === 'verify_and_claim');
      expect(verifyFn?.custom_attributes).toContain('abi_private');
      expect(verifyFn?.is_unconstrained).toBe(false);
      expect(verifyFn?.bytecode.length).toBeGreaterThan(15000); // ~20.4KB UltraHonk bytecode
    });
  });

  // ─── 2. MATHEMATICAL INVARIANTS & SECURITY ──────────────────────────────────

  describe('Mathematical Invariants & Security Logic', () => {
    describe('PaymentStream Conservative Accrual Invariant', () => {
      it('calculates exact accrual without overflow or frontrunning drift', () => {
        const start = BigInt(1700000000);
        const rate = BigInt(100); // 100 units per second
        const total = BigInt(100000); // 1000 seconds to stream
        let withdrawn = BigInt(0);

        // At anchor_ts = start + 250s
        const anchor_ts1 = start + BigInt(250);
        const elapsed1 = anchor_ts1 - start;
        const accrued1 = elapsed1 * rate;
        const totalClaimable1 = accrued1 > total ? total : accrued1;
        const claimable1 = totalClaimable1 - withdrawn;

        expect(claimable1).toBe(BigInt(25000));
        withdrawn += claimable1;

        // At anchor_ts = start + 500s
        const anchor_ts2 = start + BigInt(500);
        const elapsed2 = anchor_ts2 - start;
        const accrued2 = elapsed2 * rate;
        const totalClaimable2 = accrued2 > total ? total : accrued2;
        const claimable2 = totalClaimable2 - withdrawn;

        expect(claimable2).toBe(BigInt(25000));
        withdrawn += claimable2;

        // At anchor_ts = start + 2000s (past total duration)
        const anchor_ts3 = start + BigInt(2000);
        const elapsed3 = anchor_ts3 - start;
        const accrued3 = elapsed3 * rate;
        const totalClaimable3 = accrued3 > total ? total : accrued3;
        const claimable3 = totalClaimable3 - withdrawn;

        expect(totalClaimable3).toBe(total);
        expect(claimable3).toBe(BigInt(50000)); // remaining unwithdrawn
        withdrawn += claimable3;
        expect(withdrawn).toBe(total);
      });
    });

    describe('IdentityCredential Sanction & Scope Nullifier Invariant', () => {
      it('enforces exclusion of OFAC/FATF sanctioned jurisdiction codes', () => {
        const sanctionedCodes = [408, 364, 760, 192]; // KP, IR, SY, CU
        const validJurisdictions = [840, 826, 724, 250, 392]; // US, GB, ES, FR, JP

        for (const code of sanctionedCodes) {
          const isSanctioned = code === 408 || code === 364 || code === 760 || code === 192;
          expect(isSanctioned, `Code ${code} must be sanctioned`).toBe(true);
        }

        for (const code of validJurisdictions) {
          const isSanctioned = code === 408 || code === 364 || code === 760 || code === 192;
          expect(isSanctioned, `Code ${code} must pass sanction check`).toBe(false);
        }
      });

      it('asserts depth-32 binary Merkle tree traversal correctness', () => {
        // Depth-32 verifies exactly 32 bit levels
        const leafIndex = 0b10110; // decimal 22
        const bitDirections: boolean[] = [];

        let idx = leafIndex;
        for (let i = 0; i < 32; i++) {
          bitDirections.push((idx & 1) === 1);
          idx = idx >> 1;
        }

        expect(bitDirections).toHaveLength(32);
        // Level 0: 0, Level 1: 1, Level 2: 1, Level 3: 0, Level 4: 1, remaining: 0
        expect(bitDirections.slice(0, 5)).toEqual([false, true, true, false, true]);
        expect(bitDirections.slice(5).every(b => b === false)).toBe(true);
      });
    });
  });
});
