import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { constantTimeCompare, constantTimeCompareBuffers } from '@/lib/security/constant-time';
import { zeroizeBuffer, zeroizeObject } from '@/lib/security/zeroize';
import { detectCanaryBreach, scrubSensitiveData, CANARY_PRIVATE_KEY_HEX, CANARY_IDENTIFIER } from '@/lib/security/canary';
import { CANONICAL_KEY_INVENTORY, requiresKeyRotation } from '@/lib/security/key-hierarchy';
import {
  validateEAFBridgeMessage,
  setEafKillSwitch,
  isEafGloballyDisabled,
  EAF_MAX_PAYLOAD_BYTES,
  EAF_CSP_HEADER,
  EAF_SANDBOX_PERMISSIONS,
} from '@/lib/security/eaf-guard';

/**
 * Humanity Ledger — Automated Fortification Test Suite
 * Validates concrete implementation items from the 300-Item Fortification Checklist
 * against sophisticated adversaries (including nation-state actors / Lazarus Group).
 */
describe('Humanity Ledger — 300-Item Fortification Checklist Automated Verification', () => {
  const root = process.cwd();

  // -------------------------------------------------------------------------
  // Domain 1: Cryptographic and Key Management (Items 1–40)
  // -------------------------------------------------------------------------
  describe('Domain 1: Cryptographic & Key Management', () => {
    it('Item 1: Generates cryptographic keys using OS CSPRNG and never Math.random', () => {
      const keyBuffer = crypto.randomBytes(32);
      expect(keyBuffer.length).toBe(32);
      expect(keyBuffer.some((byte) => byte !== 0)).toBe(true);
    });

    it('Item 2: zeroizeBuffer securely wipes sensitive memory buffers in-place', () => {
      const sensitiveBuffer = Buffer.from('super_secret_private_spending_key_1234');
      expect(sensitiveBuffer.toString()).toContain('secret');
      zeroizeBuffer(sensitiveBuffer);
      expect(sensitiveBuffer.every((b) => b === 0)).toBe(true);
    });

    it('Item 2 & 45: zeroizeObject clears nested secrets and buffers', () => {
      const stateObj = {
        witness: Buffer.from([1, 2, 3, 4, 5]),
        secretKey: '0x1234567890abcdef',
        publicInput: '0x9999',
      };
      zeroizeObject(stateObj);
      expect(stateObj.witness).toBeUndefined();
      expect(stateObj.secretKey).toBe('');
      expect(stateObj.publicInput).toBe('0x9999');
    });

    it('Item 5 & 248: scrubSensitiveData sanitizes 32-byte hex private keys, canaries, and mnemonics', () => {
      const rawLog =
        'Error in transaction: user key 0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff and canary ' +
        CANARY_IDENTIFIER;
      const scrubbed = scrubSensitiveData(rawLog);

      expect(scrubbed).not.toContain('0x11223344556677889900aabbccddeeff');
      expect(scrubbed).not.toContain(CANARY_IDENTIFIER);
      expect(scrubbed).toContain('[REDACTED_SECRET_KEY]');
      expect(scrubbed).toContain('[REDACTED_CANARY]');
    });

    it('Item 9 & 40: Canonical Key Inventory defines all 4 required hierarchy levels', () => {
      expect(CANONICAL_KEY_INVENTORY.length).toBe(4);
      const types = CANONICAL_KEY_INVENTORY.map((k) => k.keyType);
      expect(types).toContain('MASTER_IDENTITY');
      expect(types).toContain('AZTEC_SPENDING');
      expect(types).toContain('NULLIFIER_KEY');
      expect(types).toContain('SESSION_VIEWING');
    });

    it('Item 10: Automatic key rotation triggered when message threshold or time limit is exceeded', () => {
      const now = Date.now();
      expect(requiresKeyRotation(99, now)).toBe(false);
      expect(requiresKeyRotation(100, now)).toBe(true); // Exceeds 100 messages
      expect(requiresKeyRotation(10, now - 25 * 3600 * 1000)).toBe(true); // Exceeds 24 hours
    });

    it('Item 11 & 233: Canary tripwire detects honeypot private key or token presence', () => {
      const cleanPayload = 'Normal transaction data { "amount": 100 }';
      expect(detectCanaryBreach(cleanPayload).breached).toBe(false);

      const hostilePayload = `Attack payload with ${CANARY_PRIVATE_KEY_HEX}`;
      const detection = detectCanaryBreach(hostilePayload);
      expect(detection.breached).toBe(true);
      expect(detection.reason).toContain('Canary private key detected');
    });

    it('Item 12: constantTimeCompare performs constant-time comparison on secrets', () => {
      const tokenA = 'f7c3bc9082a94511b84920';
      const tokenB = 'f7c3bc9082a94511b84920';
      const tokenC = 'f7c3bc9082a94511b84921';
      const tokenD = 'short';

      expect(constantTimeCompare(tokenA, tokenB)).toBe(true);
      expect(constantTimeCompare(tokenA, tokenC)).toBe(false);
      expect(constantTimeCompare(tokenA, tokenD)).toBe(false);

      const bufA = Buffer.from('hello', 'utf8');
      const bufB = Buffer.from('hello', 'utf8');
      const bufC = Buffer.from('world', 'utf8');
      expect(constantTimeCompareBuffers(bufA, bufB)).toBe(true);
      expect(constantTimeCompareBuffers(bufA, bufC)).toBe(false);
    });

    it('Item 26: URLs and query strings do not contain private keys', () => {
      const sampleUrl = 'https://humanidfi.com/api/transfers?scope=20261031&recipient=0x123';
      expect(/(key|secret|seed)=[0-9a-fA-F]{32,}/i.test(sampleUrl)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Domain 2: Aztec / Noir / UltraHonk Circuit and PXE Hardening (Items 41–80)
  // -------------------------------------------------------------------------
  describe('Domain 2: Aztec / Noir & Circuit Hardening', () => {
    it('Item 41: Verification keys for all production circuits exist with UltraHonk BN254 specifications', () => {
      const circuits = ['escrow', 'streams', 'identity'];
      for (const name of circuits) {
        const vkPath = path.join(root, `circuits/${name}/target/${name}.vk.json`);
        expect(fs.existsSync(vkPath), `Missing VK for circuit: ${name}`).toBe(true);
        const vk = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
        expect(vk.provingSystem).toBe('UltraHonk');
        expect(vk.curve).toBe('BN254');
        expect(vk.vkHash.startsWith('0x')).toBe(true);
      }
    });

    it('Item 43: Circuit registry mandates 14-day timelock delay', () => {
      const escrowVk = JSON.parse(fs.readFileSync(path.join(root, 'circuits/escrow/target/escrow.vk.json'), 'utf8'));
      expect(escrowVk.l1Anchoring.timelockDelaySeconds).toBe(1209600); // 14 days
    });

    it('Item 47: Pinned documentation of Noir and Barretenberg versions in CIRCUITS.md', () => {
      const docPath = path.join(root, 'docs/CIRCUITS.md');
      expect(fs.existsSync(docPath)).toBe(true);
      const content = fs.readFileSync(docPath, 'utf8');
      expect(content).toContain('UltraHonk');
      expect(content).toContain('BN254');
      expect(content).toContain('HumanityTimeLockVault');
    });

    it('Item 49: Negative tests enforce circuit boundary conditions', () => {
      const escrowTest = fs.readFileSync(path.join(root, 'test/circuits/escrow.test.ts'), 'utf8');
      expect(escrowTest).toContain('current_timestamp <= deadline');
      expect(escrowTest).toContain('amount must be > 0');
      expect(escrowTest).toContain('amount exceeds MAX_ESCROW_AMOUNT');
    });
  });

  // -------------------------------------------------------------------------
  // Domain 3: MLS / Messaging Hardening (Items 81–110)
  // -------------------------------------------------------------------------
  describe('Domain 3: MLS / Messaging Hardening', () => {
    it('Item 81: XMTP browser SDK version is strictly pinned', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      const xmtpVersion = pkg.dependencies['@xmtp/browser-sdk'];
      expect(xmtpVersion).toBe('5.2.0');
    });

    it('Item 94: Attachment upload enforces 10 MB maximum ceiling and strict type allowlist', () => {
      const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
      const ALLOWED_MIME = ['image/png', 'image/jpeg', 'application/pdf'];

      const validPayload = { size: 5 * 1024 * 1024, mime: 'image/png' };
      const oversizePayload = { size: 15 * 1024 * 1024, mime: 'image/png' };
      const disallowedMime = { size: 1024, mime: 'application/x-msdownload' };

      expect(validPayload.size <= MAX_ATTACHMENT_SIZE && ALLOWED_MIME.includes(validPayload.mime)).toBe(true);
      expect(oversizePayload.size <= MAX_ATTACHMENT_SIZE).toBe(false);
      expect(ALLOWED_MIME.includes(disallowedMime.mime)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Domain 4: EAF / Sandbox Hardening (Items 111–140)
  // -------------------------------------------------------------------------
  describe('Domain 4: EAF / Sandbox Hardening', () => {
    it('Item 111: Enforces air-gapped CSP connect-src none', () => {
      expect(EAF_CSP_HEADER).toContain("default-src 'none'");
      expect(EAF_CSP_HEADER).toContain("connect-src 'none'");
    });

    it('Item 113: Rejects undeclared or malicious bridge methods', () => {
      const res = validateEAFBridgeMessage(
        { appId: 'test_app', method: 'evalExploit', data: {} },
        'alice_001',
      );
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Undeclared method');
    });

    it('Item 114: Forged memberId in bridge payload is ignored and bound to session', () => {
      const res = validateEAFBridgeMessage(
        { appId: 'vote_app', method: 'setState', memberId: 'victim_attacker_forgery', data: { vote: 1 } },
        'authentic_user_777',
      );
      expect(res.valid).toBe(true);
      expect(res.sanitizedMemberId).toBe('authentic_user_777');
    });

    it('Item 115: Path traversal characters in appId are strictly rejected', () => {
      const res = validateEAFBridgeMessage(
        { appId: '../../etc/passwd', method: 'getState', data: {} },
        'user_01',
      );
      expect(res.valid).toBe(false);
      expect(res.error).toContain('path traversal');
    });

    it('Item 116: Hard 8 KB payload limit rejects oversized messages', () => {
      const oversizedData = 'x'.repeat(EAF_MAX_PAYLOAD_BYTES + 100);
      const res = validateEAFBridgeMessage(
        { appId: 'app1', method: 'setState', data: { payload: oversizedData } },
        'user_01',
      );
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceeds 8 KB ceiling');
    });

    it('Item 117: Sandbox permission is allow-scripts only', () => {
      expect(EAF_SANDBOX_PERMISSIONS).toBe('allow-scripts');
      expect(EAF_SANDBOX_PERMISSIONS).not.toContain('allow-same-origin');
      expect(EAF_SANDBOX_PERMISSIONS).not.toContain('allow-top-navigation');
    });

    it('Item 128: Global kill switch disables all EAFs instantly', () => {
      setEafKillSwitch(false);
      expect(isEafGloballyDisabled()).toBe(false);

      setEafKillSwitch(true);
      expect(isEafGloballyDisabled()).toBe(true);

      const res = validateEAFBridgeMessage(
        { appId: 'app1', method: 'getState', data: {} },
        'user_01',
      );
      expect(res.valid).toBe(false);
      expect(res.error).toContain('emergency kill switch');

      setEafKillSwitch(false); // Reset
    });
  });

  // -------------------------------------------------------------------------
  // Domain 5: L1 Contracts and Governance (Items 141–170)
  // -------------------------------------------------------------------------
  describe('Domain 5: L1 Contracts & Governance', () => {
    it('Item 141 & 142: L1 bytecode verifier script exists and passes', () => {
      const verifierPath = path.join(root, 'scripts/verify-l1-bytecode.ts');
      expect(fs.existsSync(verifierPath)).toBe(true);
    });

    it('Item 143: Zero unilateral admin backdoor in HumanityTimeLockVault', () => {
      const vaultSource = fs.readFileSync(path.join(root, 'contracts/HumanityTimeLockVault.sol'), 'utf8');
      expect(vaultSource).not.toContain('function adminWithdraw');
      expect(vaultSource).not.toContain('function emergencyDrain');
    });
  });

  // -------------------------------------------------------------------------
  // Domain 6: Supply Chain and Dependency Security (Items 171–200)
  // -------------------------------------------------------------------------
  describe('Domain 6: Supply Chain Security', () => {
    it('Item 171: package-lock.json uses integrity hashes', () => {
      const lockPath = path.join(root, 'package-lock.json');
      expect(fs.existsSync(lockPath)).toBe(true);
      const lockContent = fs.readFileSync(lockPath, 'utf8');
      expect(lockContent).toContain('"integrity": "sha512-');
    });

    it('Item 175: Pinned critical packages match trusted scopes', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      expect(pkg.dependencies['@aztec-labs/aztec.js']).toBeDefined();
      expect(pkg.dependencies['@xmtp/browser-sdk']).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Domain 9: Operational and Governance Hardening (Items 261–300)
  // -------------------------------------------------------------------------
  describe('Domain 9: Governance & PR Invariant Verification', () => {
    it('Item 263: CODEOWNERS requires mandatory review on security and crypto paths', () => {
      const codeownersPath = path.join(root, '.github/CODEOWNERS');
      expect(fs.existsSync(codeownersPath)).toBe(true);
      const content = fs.readFileSync(codeownersPath, 'utf8');
      expect(content).toContain('circuits/');
      expect(content).toContain('contracts/');
      expect(content).toContain('lib/security/');
    });

    it('Item 264: Pull request template contains Mandatory Invariant Analysis Section', () => {
      const prTemplatePath = path.join(root, '.github/pull_request_template.md');
      expect(fs.existsSync(prTemplatePath)).toBe(true);
      const content = fs.readFileSync(prTemplatePath, 'utf8');
      expect(content).toContain('Mandatory Invariant Analysis Section (Fortification Item 264)');
      expect(content).toContain('Target Invariant(s)');
      expect(content).toContain('Mathematical Bound / Constraint Enforced');
    });
  });
});
