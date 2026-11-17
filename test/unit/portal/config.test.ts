import { describe, it, expect } from 'vitest';
import { parsePortalConfig } from '@/lib/portal/config';

const base = {
  NEXT_PUBLIC_HL_PORTAL: '0x' + '1'.repeat(40),
  NEXT_PUBLIC_HL_RECEIVER_FACTORY: '0x' + '2'.repeat(40),
  NEXT_PUBLIC_HL_RECEIVER_IMPLEMENTATION: '0x' + '3'.repeat(40),
  NEXT_PUBLIC_HL_PORTAL_L1_CHAIN_ID: '11155111',
  NEXT_PUBLIC_HL_PORTAL_ASSETS: JSON.stringify([
    { symbol: 'DAI', l1: '0x' + 'a'.repeat(40), l2: '0x' + 'b'.repeat(64), decimals: 18 },
    { symbol: 'ETH', l1: '0x' + 'c'.repeat(40), l2: '0x' + 'd'.repeat(64), decimals: 18 },
    { symbol: 'bad', l1: '0x12', l2: '0x' + 'd'.repeat(64), decimals: 18 },
  ]),
  NEXT_PUBLIC_HL_PORTAL_TOKEN_ARTIFACT: '/aztec/portal_token-PortalToken.json',
  NEXT_PUBLIC_HL_PORTAL_DEPLOY_BLOCK: '123',
};

describe('portal config', () => {
  it('is off unless every value is set and valid (the default: nothing deployed)', () => {
    expect(parsePortalConfig({})).toBeNull();
    expect(parsePortalConfig({ ...base, NEXT_PUBLIC_HL_PORTAL: '0x123' })).toBeNull();
    expect(parsePortalConfig({ ...base, NEXT_PUBLIC_HL_PORTAL_L1_CHAIN_ID: '5' })).toBeNull();
    expect(parsePortalConfig({ ...base, NEXT_PUBLIC_HL_PORTAL_ASSETS: '[]' })).toBeNull();
    expect(parsePortalConfig({ ...base, NEXT_PUBLIC_HL_PORTAL_TOKEN_ARTIFACT: 'https://evil.example/a.json' })).toBeNull();
  });

  it('parses assets, drops invalid ones, marks ETH native', () => {
    const c = parsePortalConfig(base)!;
    expect(c.assets.map((a) => a.symbol)).toEqual(['DAI', 'ETH']);
    expect(c.assets.find((a) => a.symbol === 'ETH')!.native).toBe(true);
    expect(c.deployBlock).toBe(123n);
    expect(c.l1ChainId).toBe(11155111);
  });

  it('pairs the Aztec test network with Sepolia and Alpha with Ethereum only', () => {
    expect(parsePortalConfig(base, 'testnet')).not.toBeNull();
    expect(parsePortalConfig(base, 'mainnet')).toBeNull();
    expect(parsePortalConfig({ ...base, NEXT_PUBLIC_HL_PORTAL_L1_CHAIN_ID: '1' }, 'testnet')).toBeNull();
  });

  it('on Ethereum, every symbol must be the canonical token with its real decimals', () => {
    const main = {
      ...base,
      NEXT_PUBLIC_HL_PORTAL_L1_CHAIN_ID: '1',
      NEXT_PUBLIC_HL_PORTAL_ASSETS: JSON.stringify([
        { symbol: 'USDC', l1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', l2: '0x' + 'b'.repeat(64), decimals: 6 },
        { symbol: 'ETH', l1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', l2: '0x' + 'd'.repeat(64), decimals: 18 },
      ]),
    };
    expect(parsePortalConfig(main, 'mainnet')!.assets.map((a) => a.symbol)).toEqual(['USDC', 'ETH']);
    const lookalike = JSON.stringify([{ symbol: 'USDC', l1: '0x' + 'a'.repeat(40), l2: '0x' + 'b'.repeat(64), decimals: 6 }]);
    expect(parsePortalConfig({ ...main, NEXT_PUBLIC_HL_PORTAL_ASSETS: lookalike }, 'mainnet')).toBeNull();
    const wrongDecimals = JSON.stringify([{ symbol: 'USDC', l1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', l2: '0x' + 'b'.repeat(64), decimals: 18 }]);
    expect(parsePortalConfig({ ...main, NEXT_PUBLIC_HL_PORTAL_ASSETS: wrongDecimals }, 'mainnet')).toBeNull();
  });

  it('refuses a build where two contracts share an address or two assets share a token', () => {
    expect(parsePortalConfig({ ...base, NEXT_PUBLIC_HL_RECEIVER_FACTORY: base.NEXT_PUBLIC_HL_PORTAL })).toBeNull();
    const dup = JSON.stringify([
      { symbol: 'DAI', l1: '0x' + 'a'.repeat(40), l2: '0x' + 'b'.repeat(64), decimals: 18 },
      { symbol: 'ETH', l1: '0x' + 'c'.repeat(40), l2: '0x' + 'b'.repeat(64), decimals: 18 },
    ]);
    expect(parsePortalConfig({ ...base, NEXT_PUBLIC_HL_PORTAL_ASSETS: dup })).toBeNull();
  });
});
