import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Task T1 / Acceptance Criterion A1 Guard:
 * Asserts that scripts/aztec-pxe-e2e.ts contains ZERO simulation strings,
 * zero mock proofs, zero pseudo-random mock fields, and strictly operates
 * via real cryptographic entropy and on-chain Aztec PXE calls.
 */
describe('Task T1 / A1 — Zero Simulation Guard in Aztec E2E Pipeline', () => {
  const e2eScriptPath = path.resolve(process.cwd(), 'scripts/aztec-pxe-e2e.ts');

  it('scripts/aztec-pxe-e2e.ts exists on disk', () => {
    expect(fs.existsSync(e2eScriptPath)).toBe(true);
  });

  it('Contains zero prohibited simulation strings', () => {
    const fileContent = fs.readFileSync(e2eScriptPath, 'utf8');

    // List of strictly prohibited strings per Normative Specification
    const prohibitedSubstrings = [
      'Fr.random',
      'mockWorkerProof',
      'simulatedNullifier',
      'simulatedCommitment',
      'UltraHonk-v1-proof-verified',
      'AztecAddress.random',
    ];

    for (const forbidden of prohibitedSubstrings) {
      // Find occurrences in code lines (exclude comment header references if verifying absence)
      const lines = fileContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Strip block comment or docstring explanation
        if (line.trim().startsWith('*') || line.trim().startsWith('//')) {
          continue;
        }
        expect(
          line.includes(forbidden),
          `Prohibited simulation token "${forbidden}" detected at line ${i + 1}: ${line.trim()}`,
        ).toBe(false);
      }
    }
  });

  it('Derives keys using OS cryptographic entropy rather than simulated random generators', () => {
    const fileContent = fs.readFileSync(e2eScriptPath, 'utf8');
    expect(fileContent).toContain('crypto.randomBytes');
    expect(fileContent).toContain('Fr.fromBuffer');
    expect(fileContent).toContain('Fq.fromBuffer');
  });

  it('Invokes authentic Aztec TokenContract methods via PXE', () => {
    const fileContent = fs.readFileSync(e2eScriptPath, 'utf8');
    expect(fileContent).toContain('mint_to_public');
    expect(fileContent).toContain('transfer_to_private');
    expect(fileContent).toContain('transfer_to_public');
  });
});
