/**
 * Operator decision PA-1 (19/11/2026): HLC is a test token; cUSDC is planned for real payments
 * and stays off until every gate is met. These checks keep the code, the record and the words
 * saying the same thing.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkAlphaConfig } from '../../../scripts/aztec/check-alpha-config.mjs';
import {
  ASSETS_SENTENCE, CUSDC_GATES, PLANNED_TOKENS, TEST_TOKEN_NOTE, cusdcReady, isTestToken, roleOf, withoutGatedTokens,
} from '@/lib/payments/assets';

const record = JSON.parse(fs.readFileSync('deployments/aztec-mainnet.json', 'utf8'));
const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('payment assets (PA-1)', () => {
  it('HLC is recorded as a test token with no monetary value', () => {
    const hlc = record.tokens.find((t: { symbol: string }) => t.symbol === 'HLC');
    expect(hlc.role).toBe('test');
    expect(hlc.monetaryValue).toBe('none');
    expect(isTestToken('HLC')).toBe(true);
    expect(isTestToken(' hlc ')).toBe(true);
    expect(roleOf('HLC')).toBe('test');
    expect(TEST_TOKEN_NOTE).toBe('Test token · no monetary value');
  });

  it('cUSDC is planned, unverified, issued by human.tech, and never in the list the wallet may use', () => {
    const c = PLANNED_TOKENS.find((t) => t.symbol === 'cUSDC')!;
    expect(c).toBeDefined();
    expect(c.status).toBe('planned');
    expect(c.role).toBe('real');
    expect(c.verifiedOnChain).toBe(false);
    expect(c.issuer).toMatch(/human\.tech/);
    expect(c.address).toMatch(/^0x[0-9a-f]{64}$/);
    expect(c.source).toBe('https://support.shield.human.tech/contracts');
    expect(c.readOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const listed = new Set(record.tokens.map((t: { address: string }) => t.address.toLowerCase()));
    for (const p of PLANNED_TOKENS) expect(listed.has(p.address.toLowerCase()), p.symbol).toBe(false);
  });

  it('cUSDC stays off while any gate is unmet', () => {
    expect(CUSDC_GATES.map((g) => g.id)).toEqual(['legal', 'entity', 'onchain', 'alpha', 'operator', 'issuerWrittenClassification', 'legalNoteNotCasp', 'sanctionsPolicy', 'insurance']);
    expect(cusdcReady()).toBe(false);
    expect(cusdcReady(CUSDC_GATES.map((g) => ({ ...g, met: true })))).toBe(true);
    expect(cusdcReady(CUSDC_GATES.map((g, i) => ({ ...g, met: i !== 0 })))).toBe(false);
  });

  it('the wallet never lists cUSDC while any gate is false, even if configured', () => {
    const c = PLANNED_TOKENS[0];
    const hlc = { symbol: 'HLC', address: '0x' + '11'.repeat(32) };
    const cusdc = { symbol: c.symbol, address: c.address };
    expect(withoutGatedTokens([hlc, cusdc])).toEqual([hlc]);
    expect(withoutGatedTokens([hlc, { ...cusdc, symbol: 'X' }])).toEqual([hlc]); // by address too
    for (let i = 0; i < CUSDC_GATES.length; i++) {
      const gates = CUSDC_GATES.map((g, j) => ({ ...g, met: j !== i }));
      expect(withoutGatedTokens([hlc, cusdc], gates), CUSDC_GATES[i].id).toEqual([hlc]);
    }
    expect(withoutGatedTokens([hlc, cusdc], CUSDC_GATES.map((g) => ({ ...g, met: true })))).toEqual([hlc, cusdc]);
    expect(fs.readFileSync('lib/aztec/wallet/config.ts', 'utf8')).toMatch(/tokens: withoutGatedTokens\(/);
  });

  it('the build check refuses cUSDC if someone configures it before it is recorded in tokens', () => {
    const c = PLANNED_TOKENS[0];
    const env = {
      NEXT_PUBLIC_AZTEC_NETWORK: 'alpha',
      NEXT_PUBLIC_AZTEC_ALPHA_ENABLED: 'true',
      NEXT_PUBLIC_AZTEC_L1_CHAIN_ID: '1',
      NEXT_PUBLIC_AZTEC_EXPLORER: 'https://aztecscan.xyz',
      NEXT_PUBLIC_AZTEC_TOKENS: JSON.stringify({ DAI: { address: c.address, symbol: c.symbol, decimals: c.decimals } }),
    };
    expect(checkAlphaConfig(env, record).errors.join('\n')).toMatch(/not recorded/);
  });

  it('the wallet, the send review, the landing and the token model all say HLC is a test token', () => {
    expect(read('components/zk/ZkWalletPanel.tsx')).toMatch(/isTestToken\(main\.symbol\)[^]*TEST_TOKEN_NOTE/);
    expect(read('components/zk/wallet/WalletSheets.tsx')).toMatch(/isTestToken\(symbol\)/);
    expect(read('lib/landing/content.ts')).toMatch(/HLC is a test token with no monetary value, used only to test private payments/);
    expect(read('lib/landing/content.ts')).toMatch(/planned in cUSDC/);
    expect(read('docs/TOKENOMICS.md')).toMatch(/Withdrawn on 19 November 2026/);
    expect(read('lib/protocol/tokenomics.ts')).toMatch(/MODEL_STATUS = 'withdrawn'/);
    expect(ASSETS_SENTENCE).toMatch(/^HLC is a test token with no monetary value/);
  });

  it('no partnership words about human.tech or Aztec in the asset texts', () => {
    const texts = [read('lib/payments/assets.ts'), JSON.stringify(record.plannedTokens), record.$plannedTokensComment];
    for (const t of texts) expect(t).not.toMatch(/partner|official|backed by|endorse/i);
  });
});
