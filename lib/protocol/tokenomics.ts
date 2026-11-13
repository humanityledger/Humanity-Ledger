/**
 * lib/protocol/tokenomics.ts
 *
 * The approved HLC model, as data. The landing page, /protocol and docs/TOKENOMICS.md read from
 * here, so the published figures cannot drift from each other. All quantities are bigint base
 * units (6 decimals, as the deployed token); percentages are basis points.
 *
 * This is a plan, not an offer: nothing is sold or distributed until every launch condition at
 * the bottom is met and recorded. The deployed HLC contract today still has a live admin that can
 * grant minting rights (see /protocol), so the fixed supply below is a commitment to be enforced
 * on-chain at genesis, not yet a property of the contract.
 */

export const HLC_DECIMALS = 6;
const UNIT = 10n ** BigInt(HLC_DECIMALS);
export const HLC_MAX_SUPPLY = 1_000_000_000n * UNIT;
export const BPS = 10_000n;

export interface Allocation {
  id: 'community' | 'fair-launch' | 'treasury' | 'team';
  label: string;
  bps: bigint;
  /** Base units: HLC_MAX_SUPPLY * bps / 10_000. */
  amount: bigint;
  terms: string;
}

const alloc = (id: Allocation['id'], label: string, bps: bigint, terms: string): Allocation => ({
  id,
  label,
  bps,
  amount: (HLC_MAX_SUPPLY * bps) / BPS,
  terms,
});

export const ALLOCATIONS: readonly Allocation[] = [
  alloc('community', 'Community airdrop', 4_500n, 'Real users only, weighted by settled escrow activity. Sybil-filtered. No purchase.'),
  alloc('fair-launch', 'Fair launch', 2_000n, 'One price for everyone. No discounts, no private round, no venture capital.'),
  alloc('treasury', 'Protocol treasury', 2_000n, 'Multisig 4 of 7 with a 48-hour timelock. Every movement public on-chain.'),
  alloc('team', 'Team', 1_500n, '18-month cliff, then linear to month 48. Unvested tokens can be cancelled back to the treasury.'),
];

/** Value return (approved 13 Nov 2026): every protocol fee buys HLC on the open market and burns it. */
export const FEE_ROUTING = {
  buybackAndBurnBps: 10_000n,
  holderDistributionBps: 0n,
  method: 'Open-market purchase spread over a 7-day TWAP, executed by a public contract; purchased HLC is burned.',
} as const;

/** Staking gives utility, never a share of fees: lower agreement fees and onboarding sponsorship quota. */
export const STAKING_LOCKS = [
  { id: 'flexible', label: 'Flexible', months: 0, weightBps: 10_000n },
  { id: '6m', label: '6 months', months: 6, weightBps: 18_000n },
  { id: '12m', label: '12 months', months: 12, weightBps: 30_000n },
  { id: '24m', label: '24 months', months: 24, weightBps: 50_000n },
] as const;

/** Staking weight in base units: amount × lock multiplier. Pure bigint, floors. */
export function stakingWeight(amount: bigint, lockId: (typeof STAKING_LOCKS)[number]['id']): bigint {
  if (amount < 0n) throw new Error('negative amount');
  const lock = STAKING_LOCKS.find((l) => l.id === lockId);
  if (!lock) throw new Error(`unknown lock ${lockId}`);
  return (amount * lock.weightBps) / BPS;
}

export const TEAM_VESTING = { cliffMonths: 18, totalMonths: 48 } as const;

/** Team tokens vested after `months` since genesis: 0 before the cliff, linear to the end, floors. */
export function teamVested(months: number): bigint {
  if (!Number.isInteger(months) || months < 0) throw new Error('months must be a non-negative integer');
  const team = ALLOCATIONS.find((a) => a.id === 'team')!.amount;
  if (months < TEAM_VESTING.cliffMonths) return 0n;
  if (months >= TEAM_VESTING.totalMonths) return team;
  return (team * BigInt(months)) / BigInt(TEAM_VESTING.totalMonths);
}

/** Agreement fee: ceiling division so splitting a payment never pays less; a minimum per agreement. */
export function agreementFee(amount: bigint, feeBps: bigint, minFee: bigint): bigint {
  if (amount <= 0n || feeBps < 0n || minFee < 0n) throw new Error('invalid fee input');
  const proportional = (amount * feeBps + BPS - 1n) / BPS;
  return proportional > minFee ? proportional : minFee;
}

export interface LaunchCondition {
  id: string;
  label: string;
  /** Met today? Each is set to true only with evidence recorded in the repository. */
  met: boolean;
  evidence: string;
}

/** Non-negotiable. HLC is not launched while any of these is false. */
export const LAUNCH_CONDITIONS: readonly LaunchCondition[] = [
  { id: 'fee-contract', label: 'Fee contract deployed on Aztec Alpha and externally audited', met: false, evidence: 'deployments/aztec-mainnet.json: no fee contract, audit null' },
  { id: 'six-months-fees', label: 'Six months of real fees visible on /protocol', met: false, evidence: '/protocol: protocol fees not deployed' },
  { id: 'supply-locked', label: 'Supply fixed: minters revoked, admin renounced, allocations in a verified multisig', met: false, evidence: '/protocol: HLC admin is live' },
  { id: 'legal-opinion', label: 'Legal opinion on MiCA / ESMA classification and a notified white paper', met: false, evidence: 'docs/PENDING_STEFAN.md' },
  { id: 'no-vc', label: 'No venture capital and no private round, ever', met: true, evidence: 'ALLOCATIONS: no investor allocation' },
];

export const allocationTotalBps = (): bigint => ALLOCATIONS.reduce((s, a) => s + a.bps, 0n);
export const allocationTotalAmount = (): bigint => ALLOCATIONS.reduce((s, a) => s + a.amount, 0n);
