/**
 * The wallet sheets pick their token at render time (walletLogic.effectiveToken): cUSDC is listed
 * for beta members only after the page loads, and a choice fixed at module load left the Send
 * sheet on "0 USDC" next to a cUSDC balance, with no chip to switch (23 Nov 2026).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { effectiveToken } from '@/components/zk/wallet/walletLogic';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');
const bal = (key: string, privateUnits: bigint, publicUnits = 0n) => ({ key, privateUnits, publicUnits });

describe('effectiveToken', () => {
  it('keeps the choice while it is listed', () => {
    expect(effectiveToken('USDC', [{ key: 'USDC' }, { key: 'CUSDC' }], [bal('CUSDC', 5n)], 'private', 'USDC')).toBe('USDC');
  });

  it('moves to a listed token holding a private balance when the choice is not listed', () => {
    expect(effectiveToken(null, [{ key: 'CUSDC' }], [bal('CUSDC', 4_555_692n)], 'private', 'USDC')).toBe('CUSDC');
    expect(effectiveToken('USDC', [{ key: 'DAI' }, { key: 'CUSDC' }], [bal('DAI', 0n), bal('CUSDC', 1n)], 'private', 'USDC')).toBe('CUSDC');
  });

  it('looks at the public balance for shield, and falls back to the first listed, then to the fallback', () => {
    expect(effectiveToken(null, [{ key: 'DAI' }, { key: 'CUSDC' }], [bal('CUSDC', 0n, 3n)], 'public', 'USDC')).toBe('CUSDC');
    expect(effectiveToken(null, [{ key: 'DAI' }, { key: 'CUSDC' }], [], 'private', 'USDC')).toBe('DAI');
    expect(effectiveToken(null, [], [], 'any', 'USDC')).toBe('USDC');
  });
});

describe('sheets read the listed tokens on every render', () => {
  it('WalletSheets has no token list fixed at module load', () => {
    const src = read('components/zk/wallet/WalletSheets.tsx');
    expect(src).not.toMatch(/FIRST_TOKEN/);
    expect(src).not.toMatch(/^const TOKENS = /m);
    expect(src.match(/effectiveToken\(chosen, tokens, state\.balances/g)?.length).toBe(3);
  });

  it('the chat payment form uses the same rule', () => {
    expect(read('components/chat/ZkMoneyModal.tsx')).toMatch(/effectiveToken\(chosen, AZTEC_WALLET_CONFIG\.tokens, balances \?\? \[\], 'private'/);
    expect(read('components/chat/PaymentRequestComposer.tsx')).toMatch(/tokens\.some\(\(t\) => t\.key === chosenKey\)/);
  });
});
