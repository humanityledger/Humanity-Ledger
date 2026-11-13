import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

describe('.env.example', () => {
  it('lists every variable the code reads, with empty values', () => {
    // Exits 1 when a variable read by the code is missing or the file was edited by hand.
    expect(() => execFileSync(process.execPath, ['scripts/env-inventory.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
    const lines = readFileSync('.env.example', 'utf8').split('\n').filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.endsWith('=')).toBe(true);
  });

  it('documents the Aztec operator variables', () => {
    const src = readFileSync('.env.example', 'utf8');
    for (const n of ['NEXT_PUBLIC_AZTEC_NETWORK', 'NEXT_PUBLIC_AZTEC_ALPHA_ENABLED', 'NEXT_PUBLIC_AZTEC_SPONSOR', 'NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS']) {
      expect(src).toMatch(new RegExp(`# [^\\n]+\\n# Read in: [^\\n]+\\n${n}=\\n`));
    }
  });

  it('no public (browser) variable is named as a secret or private key', () => {
    const src = readFileSync('.env.example', 'utf8');
    expect(src).not.toMatch(/^NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PRIVATE)[A-Z0-9_]*=/m);
  });
});
