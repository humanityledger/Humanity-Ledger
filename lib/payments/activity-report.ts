/**
 * lib/payments/activity-report.ts — summaries and exports computed on this device only
 * (items 69, R10 and R11). Nothing here is sent anywhere: the input is the wallet's own activity
 * record (lib/aztec/wallet/history.ts), the output a string the person downloads.
 */

import type { Activity } from '@/lib/aztec/wallet/history';
import { formatUnits } from '@/lib/aztec/wallet/amounts';

export interface TokenMeta { key: string; symbol: string; decimals: number }

export interface TokenTotals { token: string; symbol: string; sent: bigint; received: bigint; count: number }

/** Settled sends and receives per token since `since` (ms). Failed and pending entries are left out. */
export function activityTotals(activity: readonly Activity[], tokens: readonly TokenMeta[], since = 0): TokenTotals[] {
  const by = new Map<string, TokenTotals>();
  for (const a of activity) {
    if (a.status !== 'settled' || a.createdAt < since || !a.token || !a.amount || !/^\d+$/.test(a.amount)) continue;
    if (a.kind !== 'send' && a.kind !== 'receive') continue;
    const meta = tokens.find((t) => t.key === a.token);
    if (!meta) continue;
    const t = by.get(meta.key) ?? { token: meta.key, symbol: meta.symbol, sent: 0n, received: 0n, count: 0 };
    if (a.kind === 'send') t.sent += BigInt(a.amount);
    else t.received += BigInt(a.amount);
    t.count++;
    by.set(meta.key, t);
  }
  return [...by.values()];
}

/** A spreadsheet cannot run a cell as a formula: cells that start like one are quoted. */
function cell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const KIND: Record<string, string> = { send: 'Sent', receive: 'Received', shield: 'Made private', unshield: 'Made public', faucet: 'Test tokens', issue: 'Issued', deploy: 'Account created', operator: 'Operator' };

/** CSV of settled activity between `from` and `to` (ms, inclusive), oldest first. */
export function activityCsv(activity: readonly Activity[], tokens: readonly TokenMeta[], network: string, from = 0, to = Number.MAX_SAFE_INTEGER): string {
  const rows = [['Date (UTC)', 'Type', 'Amount', 'Token', 'Counterparty', 'Transaction', 'Block', 'Network']];
  const list = activity.filter((a) => a.status === 'settled' && a.createdAt >= from && a.createdAt <= to).sort((a, b) => a.createdAt - b.createdAt);
  for (const a of list) {
    const meta = tokens.find((t) => t.key === a.token);
    const amount = a.amount && meta && /^\d+$/.test(a.amount) ? formatUnits(BigInt(a.amount), meta.decimals, meta.decimals).replace(/,/g, '') : '';
    rows.push([new Date(a.createdAt).toISOString(), KIND[a.kind] ?? a.kind, amount, meta?.symbol ?? a.token ?? '', a.counterparty ?? '', a.txHash ?? '', a.blockNumber != null ? String(a.blockNumber) : '', network]);
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/**
 * A receipt for one payment, to hand to someone else (R10). It states what it proves and what it
 * does not: the transaction exists on the network and was included in that block; the amount and
 * the parties are stated by the sender and are not proven by this text.
 */
export function paymentReceipt(a: Activity, meta: TokenMeta | undefined, network: string, explorerUrl?: string): string {
  const amount = a.amount && meta && /^\d+$/.test(a.amount) ? `${formatUnits(BigInt(a.amount), meta.decimals, meta.decimals)} ${meta.symbol}` : 'not recorded';
  return [
    'Ledger Chat payment receipt',
    '',
    `Network: ${network}`,
    `Transaction: ${a.txHash ?? 'not available'}`,
    a.blockNumber != null ? `Block: ${a.blockNumber}` : 'Block: not yet included',
    `Date (UTC): ${new Date(a.createdAt).toISOString()}`,
    `Amount (stated by the ${a.kind === 'receive' ? 'recipient' : 'sender'}): ${amount}`,
    explorerUrl ? `Check the transaction: ${explorerUrl}` : '',
    '',
    'What this proves: a transaction with this hash was included on the network.',
    'What it does not prove: the amount and the parties. On Aztec they are private, so this receipt states them; it does not prove them.',
  ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
}
