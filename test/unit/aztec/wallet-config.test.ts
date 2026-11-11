/**
 * When the private wallet counts as set up, per network, and when token flows
 * are available. Alpha opens with Fee Juice alone; token flows need a token.
 */
import { describe, it, expect } from 'vitest';
import { hasPrivateTokens, isWalletConfigured, TOKEN_ORDER, type TokenConfig } from '@/lib/aztec/wallet/config';

const token = (key: TokenConfig['key']): TokenConfig => ({ key, address: '0x' + 'cd'.repeat(32), symbol: key, decimals: 18 });
const allTokens = TOKEN_ORDER.map(token);

describe('isWalletConfigured', () => {
  it('on Alpha, needs Alpha enabled on purpose', () => {
    expect(isWalletConfigured({ network: 'mainnet', alphaEnabled: false, tokens: allTokens, sponsoredFpc: '' })).toBe(false);
  });

  it('on Alpha, opens with Fee Juice only (no token configured)', () => {
    expect(isWalletConfigured({ network: 'mainnet', alphaEnabled: true, tokens: [], sponsoredFpc: '' })).toBe(true);
  });

  it('on Alpha, still opens with tokens configured', () => {
    expect(isWalletConfigured({ network: 'mainnet', alphaEnabled: true, tokens: [token('USDC')], sponsoredFpc: '' })).toBe(true);
  });

  it('on the test network, still needs every token and the sponsor', () => {
    expect(isWalletConfigured({ network: 'testnet', alphaEnabled: false, tokens: allTokens, sponsoredFpc: '0x01' })).toBe(true);
    expect(isWalletConfigured({ network: 'testnet', alphaEnabled: false, tokens: allTokens, sponsoredFpc: '' })).toBe(false);
    expect(isWalletConfigured({ network: 'testnet', alphaEnabled: false, tokens: [token('USDC')], sponsoredFpc: '0x01' })).toBe(false);
    expect(isWalletConfigured({ network: 'testnet', alphaEnabled: true, tokens: [], sponsoredFpc: '0x01' })).toBe(false);
  });
});

describe('hasPrivateTokens', () => {
  it('is false with no token and true with at least one', () => {
    expect(hasPrivateTokens({ tokens: [] })).toBe(false);
    expect(hasPrivateTokens({ tokens: [token('DAI')] })).toBe(true);
  });
});
