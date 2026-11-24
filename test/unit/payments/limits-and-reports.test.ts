import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { limitUnits, loadLimits, personalLimitProblem, RECEIVE_ONLY_MESSAGE, saveLimits } from '@/lib/payments/personal-limits';
import { activityCsv, activityTotals, paymentReceipt } from '@/lib/payments/activity-report';
import type { Activity } from '@/lib/aztec/wallet/history';

const CUSDC = { key: 'CUSDC', symbol: 'cUSDC', decimals: 6 };
function memory() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; }

describe('personal limits', () => {
  it('receive-only refuses every payment', () => {
    expect(personalLimitProblem(CUSDC, 1n, { receiveOnly: true, perPayment: {} })).toBe(RECEIVE_ONLY_MESSAGE);
  });
  it('a per-payment limit refuses only what is above it', () => {
    const l = { receiveOnly: false, perPayment: { CUSDC: '5000000' } };
    expect(personalLimitProblem(CUSDC, 5_000_000n, l)).toBeNull();
    expect(personalLimitProblem(CUSDC, 5_000_001n, l)).toMatch(/Above your limit of 5 cUSDC/);
  });
  it('round-trips through storage and ignores junk', () => {
    const s = memory();
    saveLimits({ receiveOnly: true, perPayment: { CUSDC: '10' } }, s);
    expect(loadLimits(s)).toEqual({ receiveOnly: true, perPayment: { CUSDC: '10' } });
    s.setItem('hl.payments.limits.v1', '{"perPayment":{"CUSDC":"-1","X":5}}');
    expect(loadLimits(s)).toEqual({ receiveOnly: false, perPayment: {} });
    expect(limitUnits('2.5', 6)).toBe('2500000');
    expect(limitUnits('', 6)).toBeNull();
  });
  it('the wallet checks them before any proof', () => {
    const src = fs.readFileSync('lib/aztec/wallet/client.ts', 'utf8');
    const send = src.slice(src.indexOf('async send('));
    expect(send.indexOf('personalLimitProblem(')).toBeLessThan(send.indexOf('this.run('));
  });
});

const A: Activity[] = [
  { id: '1', kind: 'send', token: 'CUSDC' as any, amount: '1500000', status: 'settled', createdAt: Date.UTC(2026, 10, 1), txHash: '0xaa', blockNumber: 10 },
  { id: '2', kind: 'receive', token: 'CUSDC' as any, amount: '2000000', status: 'settled', createdAt: Date.UTC(2026, 10, 2), counterparty: '=HYPERLINK("x")' },
  { id: '3', kind: 'send', token: 'CUSDC' as any, amount: '9', status: 'failed', createdAt: Date.UTC(2026, 10, 3) },
];

describe('reports computed on the device', () => {
  it('totals count settled sends and receives only', () => {
    expect(activityTotals(A, [CUSDC])).toEqual([{ token: 'CUSDC', symbol: 'cUSDC', sent: 1_500_000n, received: 2_000_000n, count: 2 }]);
  });
  it('the CSV has one row per settled entry and neutralises formulas', () => {
    const csv = activityCsv(A, [CUSDC], 'Aztec Alpha');
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Sent,1.5,cUSDC');
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('a receipt says what it proves and what it does not', () => {
    const r = paymentReceipt(A[0], CUSDC, 'Aztec Alpha');
    expect(r).toMatch(/Transaction: 0xaa/);
    expect(r).toMatch(/does not prove: the amount and the parties/);
  });
});
