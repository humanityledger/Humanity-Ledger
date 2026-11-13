import {
  ALLOCATIONS,
  FEE_ROUTING,
  HLC_MAX_SUPPLY,
  LAUNCH_CONDITIONS,
  agreementFee,
  allocationTotalAmount,
  allocationTotalBps,
  stakingWeight,
  teamVested,
} from '@/lib/protocol/tokenomics';

describe('HLC model', () => {
  it('allocations add up to exactly the fixed supply', () => {
    expect(HLC_MAX_SUPPLY).toBe(1_000_000_000_000_000n);
    expect(allocationTotalBps()).toBe(10_000n);
    expect(allocationTotalAmount()).toBe(HLC_MAX_SUPPLY);
    expect(ALLOCATIONS.map((a) => [a.id, a.bps])).toEqual([
      ['community', 4_500n],
      ['fair-launch', 2_000n],
      ['treasury', 2_000n],
      ['team', 1_500n],
    ]);
  });

  it('routes every fee to buyback and burn, nothing to holders', () => {
    expect(FEE_ROUTING.buybackAndBurnBps).toBe(10_000n);
    expect(FEE_ROUTING.holderDistributionBps).toBe(0n);
  });

  it('team vesting: nothing before month 18, linear to month 48, never above the allocation', () => {
    const team = ALLOCATIONS.find((a) => a.id === 'team')!.amount;
    expect(teamVested(0)).toBe(0n);
    expect(teamVested(17)).toBe(0n);
    expect(teamVested(18)).toBe((team * 18n) / 48n);
    expect(teamVested(48)).toBe(team);
    expect(teamVested(120)).toBe(team);
    expect(() => teamVested(1.5)).toThrow();
  });

  it('staking weight uses the lock multipliers in bigint', () => {
    expect(stakingWeight(1_000_000n, 'flexible')).toBe(1_000_000n);
    expect(stakingWeight(1_000_000n, '6m')).toBe(1_800_000n);
    expect(stakingWeight(1_000_000n, '12m')).toBe(3_000_000n);
    expect(stakingWeight(1_000_000n, '24m')).toBe(5_000_000n);
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

  it('is not launched while a condition is unmet', () => {
    expect(LAUNCH_CONDITIONS.some((c) => !c.met)).toBe(true);
    expect(LAUNCH_CONDITIONS.find((c) => c.id === 'fee-contract')?.met).toBe(false);
  });
});
