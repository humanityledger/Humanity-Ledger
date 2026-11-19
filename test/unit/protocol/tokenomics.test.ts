import { readFileSync } from 'node:fs';
import { MODEL_STATUS, agreementFee } from '@/lib/protocol/tokenomics';

describe('HLC token model (withdrawn, PA-1)', () => {
  it('is withdrawn: no supply, allocations, buyback, staking, vesting or launch conditions remain', () => {
    expect(MODEL_STATUS).toBe('withdrawn');
    const src = readFileSync('lib/protocol/tokenomics.ts', 'utf8').replace(/\/\*[^]*?\*\//g, '');
    expect(src).not.toMatch(/ALLOCATIONS|FEE_ROUTING|STAKING|TEAM_VESTING|LAUNCH_CONDITIONS|MAX_SUPPLY|airdrop|fair-launch/);
    const doc = readFileSync('docs/TOKENOMICS.md', 'utf8');
    expect(doc).toMatch(/HLC is a test token with no monetary value/);
    expect(doc).not.toMatch(/1,000,000,000|Community airdrop|Fair launch \||buyback and burn \(decided/i);
  });

  it('agreement fee rounds up, so splitting a payment never pays less, and has a minimum', () => {
    const whole = agreementFee(1_000_000n, 30n, 0n);
    const split = agreementFee(500_000n, 30n, 0n) + agreementFee(500_000n, 30n, 0n);
    expect(whole).toBe(3_000n);
    expect(split >= whole).toBe(true);
    expect(agreementFee(1n, 30n, 0n)).toBe(1n); // dust still pays
    expect(agreementFee(10n, 30n, 500n)).toBe(500n);
    expect(() => agreementFee(0n, 30n, 0n)).toThrow();
  });
});
