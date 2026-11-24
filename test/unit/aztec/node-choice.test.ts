import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { chosenNodeUrl, nodeUrlProblem, NODE_CHOICE_KEY, setChosenNodeUrl, walletNodeRoute } from '@/lib/aztec/wallet/node-choice';

function memory(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage;
}

describe('choosing an Aztec node', () => {
  it('accepts https and a local http node, refuses the rest', () => {
    expect(nodeUrlProblem('https://aztec.example.org')).toBeNull();
    expect(nodeUrlProblem('http://localhost:8080')).toBeNull();
    expect(nodeUrlProblem('http://node.example.org')).toMatch(/https/);
    expect(nodeUrlProblem('https://u:p@node.example.org')).toMatch(/credentials/);
    expect(nodeUrlProblem('https://node.example.org/?k=1')).toMatch(/query/);
    expect(nodeUrlProblem('not a url')).toMatch(/valid/);
  });
  it('stores a normalised URL and clears it', () => {
    const s = memory();
    expect(setChosenNodeUrl('https://node.example.org/rpc/', s)).toBe('https://node.example.org/rpc');
    expect(chosenNodeUrl(s)).toBe('https://node.example.org/rpc');
    setChosenNodeUrl(null, s);
    expect(s.getItem(NODE_CHOICE_KEY)).toBeNull();
    expect(() => setChosenNodeUrl('ftp://x', s)).toThrow();
  });
  it('a chosen node never falls back to this site relay', () => {
    expect(walletNodeRoute('https://default', null)).toEqual({ url: 'https://default', relay: true, chosen: false });
    expect(walletNodeRoute('https://default', 'https://mine')).toEqual({ url: 'https://mine', relay: false, chosen: true });
  });
  it('a different rollup on the same L1 gets its own message, before any key is used', () => {
    const src = fs.readFileSync('lib/aztec/wallet/client.ts', 'utf8');
    expect(src).toMatch(/throw new Error\(`\$\{ROLLUP_CHANGED_MESSAGE\}/);
    // The store that holds keys opens after the check ('Initializing encrypted storage' also
    // appears earlier, in the tab handoff's finally, which opens nothing).
    const storeOpens = src.indexOf('// One encrypted store pair per network');
    expect(storeOpens).toBeGreaterThan(0);
    expect(src.indexOf('ROLLUP_CHANGED_MESSAGE} (')).toBeLessThan(storeOpens);
  });
});
