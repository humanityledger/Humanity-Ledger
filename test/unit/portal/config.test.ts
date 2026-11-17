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
});
