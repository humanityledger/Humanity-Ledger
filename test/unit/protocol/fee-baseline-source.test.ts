import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

function read(path: string): string {
  return fs.readFileSync(path, 'utf8');
}

function quoteBody(source: string): string {
  const start = source.indexOf('pub fn quote_protocol_fee');
  const end = source.indexOf('pub contract', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('fee baseline source', () => {
  const escrow = read('contracts/aztec/escrow/src/main.nr');
  const streams = read('contracts/aztec/streams/src/main.nr');

  it('uses the D5 constants and the designated treasury', () => {
    for (const source of [escrow, streams]) {
      expect(source).toContain('global FEE_BPS: u128 = 50;');
      expect(source).toContain('global MAX_FEE_SHARE_BPS: u128 = 1000;');
      expect(source).toContain('global TX_CAP: u128 = 5000000;');
      // Designated by Stefan Antonio Cirisanu on 17 November 2026. Not the 4-of-7 multisig.
      expect(source).toContain('global TREASURY: AztecAddress = AztecAddress { inner: 0x177395a38df8c95a572d3e7591240312b2fddbaf14d294d9e1443f3b0d55faed };');
      expect(source).not.toContain('AztecAddress { inner: 0 }');
      expect(source).not.toContain('DAILY_CAP');
      expect(source).not.toMatch(/fn\s+pause|fn\s+trigger_buyback|fn\s+set_fee_params/);
      expect(source).not.toContain('#[cfg');
    }
    expect(escrow).toContain('global MIN_FEE: u128 = 1000;');
    expect(streams).toContain('global STREAM_MIN_FEE: u128 = 0;');
    expect(quoteBody(escrow)).not.toContain('amount *');
    expect(quoteBody(streams)).not.toContain('amount *');
  });

  it('blocks deploy scripts and the composer: zero placeholder, pending recompile, Alpha without audit', () => {
    const deploy = read('scripts/aztec/deploy-keyed.ts');
    const e2e = read('scripts/aztec/e2e-escrow-testnet.mts');
    const composer = read('components/chat/AgreementComposer.tsx');
    const block = 'Deploy blocked: TREASURY is the zero placeholder.';
    expect(deploy).toContain(block);
    expect(e2e).toContain(block);
    expect(composer).toContain('TREASURY_ADDRESS_SET');
    expect(composer).toContain('baselineFee');
    expect(composer).toContain("(kind === 'escrow' && !!quote && !quote.q.ok)");
    expect(composer).not.toContain('communityMls');
    const agreements = read('lib/aztec/agreements.ts');
    expect(agreements).toContain('assertCanOpen');
    expect(agreements).toContain('baselineFee');
    expect(agreements).toContain('TREASURY_ADDRESS_SET');
    expect(agreements).toContain('each withdrawal pays its own fee');
  });
});
