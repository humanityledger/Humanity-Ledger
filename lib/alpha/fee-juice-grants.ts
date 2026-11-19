/**
 * lib/alpha/fee-juice-grants.ts
 *
 * The record of every Fee Juice grant to a tester (package 5, OD-9). Stefan makes each grant with
 * his own keys (a deposit to Aztec's Fee Juice portal for the tester's Aztec account); this only
 * records what he reports: the recipient, the amount, the transaction hash and block, the market
 * value in euros on the day and where that value comes from. The transaction is checked to exist,
 * read-only. The total never exceeds ALPHA_FEE_JUICE_BUDGET; with no budget set, nothing is
 * recorded. The CSV export is for the tax adviser (preliminary legal note, C.11).
 */
import { formatUnits, parseUnits } from '@/lib/aztec/wallet/amounts';

/** AZTEC and Fee Juice have 18 decimals. */
export const FEE_JUICE_DECIMALS = 18;
const HEX32 = /^0x[0-9a-f]{64}$/i;

export interface GrantInput {
  recipientAztecAddress: string;
  /** Whole AZTEC, as a decimal string ("20", "2.5"). */
  amount: string;
  txHash: string;
  network: 'l1' | 'l2';
  /** Market value of the amount in euros on the day, as a decimal string. */
  marketValueEur: string;
  /** Where the value comes from (exchange or index, with its date). */
  valueSource: string;
}

/** The budget in base units, or null when ALPHA_FEE_JUICE_BUDGET is empty or invalid (D-4 default). */
export function parseBudget(raw: string | undefined): bigint | null {
  if (!raw || !/^\d+(\.\d+)?$/.test(raw.trim())) return null;
  const v = parseUnits(raw.trim(), FEE_JUICE_DECIMALS);
  return v > 0n ? v : null;
}

/** Why a grant cannot be recorded, or null. `spent` = base units already recorded. */
export function grantProblem(g: Partial<GrantInput>, budget: bigint | null, spent: bigint): string | null {
  if (budget === null) return 'No Fee Juice budget is set (ALPHA_FEE_JUICE_BUDGET, OD-9). Nothing is recorded until Stefan sets it.';
  if (!g.recipientAztecAddress || !HEX32.test(g.recipientAztecAddress)) return 'recipientAztecAddress must be an Aztec address (0x + 64 hex).';
  if (!g.amount || !/^\d+(\.\d+)?$/.test(g.amount)) return 'amount must be a decimal number of AZTEC.';
  const units = parseUnits(g.amount, FEE_JUICE_DECIMALS);
  if (units <= 0n) return 'amount must be more than 0.';
  if (spent + units > budget) return `This grant would exceed the budget: ${formatUnits(spent + units, FEE_JUICE_DECIMALS, 4)} of ${formatUnits(budget, FEE_JUICE_DECIMALS, 4)} AZTEC.`;
  if (!g.txHash || !HEX32.test(g.txHash)) return 'txHash must be 0x + 64 hex.';
  if (g.network !== 'l1' && g.network !== 'l2') return 'network must be "l1" (portal deposit on Ethereum) or "l2" (Aztec).';
  if (!g.marketValueEur || !/^\d+(\.\d{1,2})?$/.test(g.marketValueEur)) return 'marketValueEur must be euros with at most 2 decimals.';
  if (!g.valueSource || g.valueSource.trim().length < 3) return 'valueSource must say where the market value comes from.';
  return null;
}

export interface GrantRow {
  grantedAt: Date;
  recipientAztecAddress: string;
  amount: string;
  network: string;
  txHash: string;
  block: number;
  marketValueEur: string;
  valueSource: string;
}

/** A spreadsheet runs a cell that starts with = + - @ (or a tab or CR) as a formula: such a cell is prefixed with ' (R2-4). */
const neutral = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const csvCell = (raw: string) => {
  const v = neutral(raw);
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

/** One line per grant, oldest first, for the tax adviser. */
export function grantsCsv(rows: GrantRow[]): string {
  const head = ['granted_at', 'recipient_aztec_address', 'amount_aztec', 'network', 'tx_hash', 'block', 'market_value_eur', 'value_source'];
  const lines = rows
    .slice()
    .sort((a, b) => a.grantedAt.getTime() - b.grantedAt.getTime())
    .map((r) => [r.grantedAt.toISOString(), r.recipientAztecAddress, r.amount, r.network, r.txHash, String(r.block), r.marketValueEur, r.valueSource].map(csvCell).join(','));
  return [head.join(','), ...lines].join('\n') + '\n';
}
