/**
 * scripts/aztec/check-alpha-config.mjs: the build-time check of the Alpha
 * configuration against deployments/aztec-mainnet.json.
 */
import { describe, it, expect } from 'vitest';
import { checkAlphaConfig } from '../../../scripts/aztec/check-alpha-config.mjs';

const A = '0x' + 'ab'.repeat(32);
const B = '0x' + 'cd'.repeat(32);
const registry = { tokens: [{ key: 'USDC', symbol: 'HLC', decimals: 6, address: A, deployBlock: 42, classId: B, status: 'active' }] };
const base = {
  NEXT_PUBLIC_AZTEC_NETWORK: 'alpha',
  NEXT_PUBLIC_AZTEC_ALPHA_ENABLED: 'true',
  NEXT_PUBLIC_AZTEC_L1_CHAIN_ID: '1',
  NEXT_PUBLIC_AZTEC_EXPLORER: 'https://aztecscan.xyz',
  NEXT_PUBLIC_AZTEC_TOKENS: JSON.stringify({ USDC: { address: A, symbol: 'HLC', decimals: 6 } }),
  NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: JSON.stringify({ [A]: '1000000000' }),
};

describe('checkAlphaConfig', () => {
  it('does nothing off Alpha', () => {
    expect(checkAlphaConfig({ NEXT_PUBLIC_AZTEC_NETWORK: undefined }, registry)).toMatchObject({ active: false, errors: [] });
  });

  it('accepts a configuration that matches the record', () => {
    expect(checkAlphaConfig(base, registry)).toEqual({ active: true, errors: [], warnings: [] });
  });

  it('accepts Fee Juice only (no tokens, no caps)', () => {
    const { errors } = checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_TOKENS: undefined, NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: undefined }, registry);
    expect(errors).toEqual([]);
  });

  it('refuses a token list written as an array', () => {
    const { errors } = checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_TOKENS: JSON.stringify([{ symbol: 'HLC', address: A, decimals: 6 }]) }, registry);
    expect(errors.join('\n')).toMatch(/must be an object/);
  });

  it('refuses a token that is not recorded, or recorded with another symbol or decimals', () => {
    expect(checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_TOKENS: JSON.stringify({ USDC: { address: B, symbol: 'HLC', decimals: 6 } }) }, registry).errors.join('\n')).toMatch(/not recorded/);
    expect(checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_TOKENS: JSON.stringify({ USDC: { address: A, symbol: 'USDC', decimals: 6 } }) }, registry).errors.join('\n')).toMatch(/symbol/);
    expect(checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_TOKENS: JSON.stringify({ USDC: { address: A, symbol: 'HLC', decimals: 18 } }) }, registry).errors.join('\n')).toMatch(/decimals/);
  });

  it('refuses caps keyed by symbol, by an unrecorded address, or with a bad amount', () => {
    expect(checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: JSON.stringify({ USDC: '1000' }) }, registry).errors.join('\n')).toMatch(/32-byte token address/);
    expect(checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: JSON.stringify({ [B]: '1000' }) }, registry).errors.join('\n')).toMatch(/not a recorded token/);
    expect(checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: JSON.stringify({ [A]: '0' }) }, registry).errors.join('\n')).toMatch(/positive decimal/);
    expect(checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: JSON.stringify({ [A]: 1000 }) }, registry).errors.join('\n')).toMatch(/positive decimal/);
  });

  it('refuses a node on another L1 and malformed JSON', () => {
    expect(checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_L1_CHAIN_ID: '11155111' }, registry).errors.join('\n')).toMatch(/chain 1/);
    expect(checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_TOKENS: '{bad' }, registry).errors.join('\n')).toMatch(/not valid JSON/);
  });

  it('warns about a recorded token still pending the preflight, and a missing explorer', () => {
    const pending = { tokens: [{ ...registry.tokens[0], deployBlock: 0, classId: null, status: 'pending-preflight' }] };
    const { errors, warnings } = checkAlphaConfig({ ...base, NEXT_PUBLIC_AZTEC_EXPLORER: undefined }, pending);
    expect(errors).toEqual([]);
    expect(warnings.join('\n')).toMatch(/not yet confirmed by the preflight/);
    expect(warnings.join('\n')).toMatch(/EXPLORER/);
  });
});
