/** Package 9: the cUSDC wallet slot exists, stays empty behind CUSDC_GATES, and does not break testnet readiness. */
import fs from 'node:fs';
import { isWalletConfigured, TESTNET_TOKEN_KEYS, TOKEN_ORDER, type TokenConfig } from '@/lib/aztec/wallet/config';
import { CUSDC_GATES, cusdcReady, withoutGatedTokens } from '@/lib/payments/assets';

const CUSDC = '0x30112e52178143b74cf6037d047bbba924f4b0db8aab587a340aacfc6ecb4f38';
const tok = (key: TokenConfig['key'], symbol: string = key, address = '0x' + 'cd'.repeat(32)): TokenConfig => ({ key, address, symbol, decimals: 6 });

describe('cUSDC slot', () => {
  it('is a wallet slot, never a test-network slot', () => {
    expect(TOKEN_ORDER).toContain('CUSDC');
    expect(TESTNET_TOKEN_KEYS).not.toContain('CUSDC');
  });
  it('testnet readiness counts the faucet slots, not the cUSDC slot', () => {
    const three = (['USDC', 'DAI', 'ETH'] as const).map((k) => tok(k));
    expect(isWalletConfigured({ network: 'testnet', alphaEnabled: false, tokens: three, sponsoredFpc: '0x01' })).toBe(true);
    expect(isWalletConfigured({ network: 'testnet', alphaEnabled: false, tokens: three.slice(0, 2), sponsoredFpc: '0x01' })).toBe(false);
  });
  it('stays out while any gate is unmet, matched by symbol or by address', () => {
    expect(CUSDC_GATES.every((g) => g.met === false)).toBe(true);
    expect(cusdcReady()).toBe(false);
    const hlc = tok('USDC', 'HLC');
    expect(withoutGatedTokens([hlc, tok('CUSDC', 'cUSDC', CUSDC)])).toEqual([hlc]);
    expect(withoutGatedTokens([hlc, tok('CUSDC', 'CUSDC2', CUSDC)])).toEqual([hlc]);
    expect(withoutGatedTokens([hlc, tok('CUSDC', 'cUSDC')])).toEqual([hlc]);
  });
  it('the config builds the slot only on Alpha and always through withoutGatedTokens', () => {
    const src = fs.readFileSync('lib/aztec/wallet/config.ts', 'utf8');
    expect(src).toMatch(/if \(key === 'CUSDC' && NETWORK !== 'mainnet'\) return \[\];/);
    expect(src).toMatch(/tokens: withoutGatedTokens\(TOKEN_ORDER\.flatMap/);
  });
  it('the planned record is still unverified on chain', () => {
    const m = JSON.parse(fs.readFileSync('deployments/aztec-mainnet.json', 'utf8'));
    const p = m.plannedTokens.find((t: { symbol: string }) => t.symbol === 'cUSDC');
    expect(p.address).toBe(CUSDC);
    expect(p.verifiedOnChain).toBe(false);
    expect(m.tokens.some((t: { symbol: string }) => t.symbol === 'cUSDC')).toBe(false);
  });
});
