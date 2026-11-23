/**
 * lib/payments/history-csv.ts: the private wallet's own activity on this device as CSV, for
 * Settings > Payments. Nothing comes from a server: the list is what this device's wallet recorded.
 * Cells that a spreadsheet would run as a formula (= + - @, tab, return) are prefixed with ' .
 */
export type HistoryRow = { createdAt: number; kind: string; amount: string; status: string; txHash?: string };

const KIND: Record<string, string> = {
  send: 'Sent', receive: 'Received', shield: 'Made private', unshield: 'Made public', faucet: 'Test tokens',
  deploy: 'Account created', issue: 'Issued', operator: 'Operator',
};

export const kindLabel = (k: string): string => KIND[k] ?? k;

function cell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function historyCsv(rows: readonly HistoryRow[]): string {
  const lines = [['Date', 'Type', 'Amount', 'Status', 'Transaction'].map(cell).join(',')];
  for (const r of [...rows].sort((a, b) => b.createdAt - a.createdAt)) {
    lines.push([new Date(r.createdAt).toISOString(), kindLabel(r.kind), r.amount, r.status, r.txHash ?? ''].map(cell).join(','));
  }
  return lines.join('\n') + '\n';
}
