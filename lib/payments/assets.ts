/**
 * lib/payments/assets.ts
 *
 * What each asset in Ledger Chat payments IS, in one place (operator decision PA-1, 19/11/2026,
 * docs/alpha/OPERATOR_DECISIONS.md):
 *
 *  - HLC is a TEST token. It has no monetary value, it is never sold or offered, and it exists so
 *    the closed alpha can exercise private payments end to end without anyone's money at risk.
 *  - cUSDC (Clean USDC, bridged to Aztec by human.tech's Shield and issued by them, not by us) is
 *    the planned asset for real payments. It stays OFF until every gate in CUSDC_GATES is met and
 *    a pull request moves it from `plannedTokens` to `tokens` in deployments/aztec-mainnet.json.
 *  - AZTEC, as Fee Juice, only pays network fees. Aztec makes it non-transferable on L2, so it is
 *    never a payment asset.
 *
 * Nothing here enables anything: the wallet still lists only tokens recorded in `tokens` and
 * configured in NEXT_PUBLIC_AZTEC_TOKENS (scripts/aztec/check-alpha-config.mjs, fail-closed).
 */
import registry from '../../deployments/aztec-mainnet.json';

export type AssetRole = 'test' | 'real' | 'fees';

/**
 * The on-chain metadata of the HLC Test Token (decision D-2, 19/11/2026). The standard Token sets
 * name, symbol and decimals in its constructor, so a new name needs a new instance: the operator
 * deploys it with these values (docs/alpha/HLC_REDEPLOY_RUNBOOK.md) and the read-only preflight
 * checks them on the node. The name has no company form: no company exists yet.
 */
export const HLC_TOKEN_META = { name: 'HLC Test Token', symbol: 'HLC', decimals: 6 } as const;

/** The words shown next to HLC wherever an amount of it appears. */
export const TEST_TOKEN_NOTE = 'Test token · no monetary value';

/** One sentence for screens and docs that explain the assets. */
export const ASSETS_SENTENCE =
  'HLC is a test token with no monetary value, used only to test private payments in the closed alpha. Real payments are planned in cUSDC, a dollar token bridged to Aztec by human.tech, and stay off until a legal review and a recorded verification.';

/** Symbols that are test tokens: never shown without TEST_TOKEN_NOTE. */
export const TEST_SYMBOLS: readonly string[] = ['HLC'];

export function isTestToken(symbol: string | undefined | null): boolean {
  return !!symbol && TEST_SYMBOLS.includes(symbol.trim().toUpperCase());
}

export interface PlannedToken {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  issuer: string;
  network: string;
  role: AssetRole;
  status: 'planned';
  source: string;
  readOn: string;
  verifiedOnChain: boolean;
}

/** Tokens recorded for later, never listed by the wallet. */
export const PLANNED_TOKENS: readonly PlannedToken[] = ((registry as { plannedTokens?: PlannedToken[] }).plannedTokens ?? []);

export interface Gate {
  id: string;
  label: string;
  met: boolean;
  evidence: string;
}

/**
 * cUSDC is switched on only when all of these are true, each with evidence recorded in the
 * repository. Set `met` to true in the same pull request that adds the evidence.
 */
export const CUSDC_GATES: readonly Gate[] = [
  { id: 'legal', label: 'Written legal note: Ledger Chat is non-custodial software and not a crypto-asset service provider for cUSDC payments', met: false, evidence: 'none yet (meeting with counsel, 19/11/2026)' },
  { id: 'entity', label: 'The operating company (S.L.) exists and its terms of use and privacy policy cover real payments', met: false, evidence: 'none yet' },
  { id: 'onchain', label: 'The cUSDC address read from Shield is confirmed on the Aztec v6 node by the read-only preflight (class and instance)', met: false, evidence: 'none yet' },
  { id: 'alpha', label: 'Closed alpha with HLC finished: delivery and payment metrics within their targets (docs/alpha/TESTER_MISSIONS.md)', met: false, evidence: 'none yet' },
  { id: 'operator', label: 'Stefan signs the switch-on, with a cap per payment in cUSDC', met: false, evidence: 'none yet' },
  // Gate 3 of the preliminary legal note (19/11/2026, B.7 and the action plan):
  { id: 'issuerWrittenClassification', label: 'Written answer from human.tech: how cUSDC qualifies under MiCA, which entity issues it, and who guarantees redemption 1:1', met: false, evidence: 'none yet' },
  { id: 'legalNoteNotCasp', label: 'Note from counsel: the integration does not make the company a crypto-asset service provider or a payment service provider', met: false, evidence: 'none yet' },
  { id: 'sanctionsPolicy', label: 'Policy on users from sanctioned countries (EU Regulation 833/2014 art. 5b and similar), with how it is applied', met: false, evidence: 'none yet' },
  { id: 'insurance', label: 'Professional liability and cyber insurance in force for real payments', met: false, evidence: 'none yet' },
];

export const cusdcReady = (gates: readonly Gate[] = CUSDC_GATES): boolean => gates.every((g) => g.met);

/**
 * The wallet's own guard: a planned token (cUSDC) is never listed while any gate is unmet, even if
 * someone configures it. Applied in lib/aztec/wallet/config.ts.
 */
export function withoutGatedTokens<T extends { symbol: string; address: string }>(tokens: T[], gates: readonly Gate[] = CUSDC_GATES): T[] {
  if (cusdcReady(gates)) return tokens;
  const planned = new Set(PLANNED_TOKENS.flatMap((p) => [p.symbol.toLowerCase(), p.address.toLowerCase()]));
  return tokens.filter((t) => !planned.has(t.symbol.toLowerCase()) && !planned.has(t.address.toLowerCase()));
}

/** The role of a recorded or planned symbol. */
export function roleOf(symbol: string): AssetRole | null {
  const s = symbol.trim().toUpperCase();
  if (isTestToken(s)) return 'test';
  if (s === 'AZTEC' || s === 'FEE JUICE') return 'fees';
  const planned = PLANNED_TOKENS.find((t) => t.symbol.toUpperCase() === s);
  return planned ? planned.role : null;
}
