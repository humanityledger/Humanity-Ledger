/**
 * The dashboard's arithmetic (lib/dashboard/model.ts): totals, counterparties, the 90-day chart,
 * filters and alerts, from the wallet's own records only.
 */
import { describe, expect, it } from 'vitest';
import { computeAlerts, computeModel, filterEvents, NO_FILTER, readBindings, type DashInputs } from '@/lib/dashboard/model';
import type { Activity } from '@/lib/aztec/wallet/history';

const NOW = new Date('2026-11-25T12:00:00Z').getTime();
const H = 3_600_000;
const A1 = '0x' + '1'.repeat(64);
const A2 = '0x' + '2'.repeat(64);
const tokens = [{ key: 'usdc', symbol: 'cUSDC', decimals: 6 }];

function act(p: Partial<Activity> & { id: string; kind: Activity['kind'] }): Activity {
  return { status: 'settled', createdAt: NOW - H, token: 'usdc', amount: '1000000', ...p } as Activity;
}

const base = (activity: Activity[], extra: Partial<DashInputs> = {}): DashInputs => ({ activity, tokens, bindings: [], contacts: [], now: NOW, ...extra });

describe('computeModel', () => {
  it('an account with no activity is a valid, empty model', () => {
    const m = computeModel(base([]));
    expect(m.events).toEqual([]);
    expect(m.totals).toEqual([]);
    expect(m.days).toHaveLength(90);
    expect(m.first).toBeUndefined();
  });

  it('sums settled payments per token and leaves failed and pending out', () => {
    const m = computeModel(base([
      act({ id: '1', kind: 'send', counterparty: A1, amount: '2500000' }),
      act({ id: '2', kind: 'receive', counterparty: A2, amount: '1000000' }),
      act({ id: '3', kind: 'send', counterparty: A1, status: 'failed' }),
      act({ id: '4', kind: 'send', counterparty: A1, status: 'pending' }),
      act({ id: '5', kind: 'shield', amount: '7' }),
    ]));
    expect(m.totals[0]).toMatchObject({ symbol: 'cUSDC', sent: 2500000n, received: 1000000n, shielded: 7n, count: 3 });
    expect(m.byStatus).toMatchObject({ settled: 3, failed: 1, pending: 1 });
    expect(m.inFlight).toBe(1);
    expect(m.failedRecent).toBe(1);
  });

  it('groups counterparties, names them from contacts and marks proven addresses', () => {
    const m = computeModel(base([act({ id: '1', kind: 'send', counterparty: A1 }), act({ id: '2', kind: 'receive', counterparty: A1.toUpperCase().replace('0X', '0x') })], {
      bindings: [{ inboxId: 'i1', aztecAddress: A1 }, { inboxId: 'i2', aztecAddress: A2 }],
      contacts: [{ address: A1, name: 'Amara' }],
    }));
    const a = m.counterparties.find((c) => c.address.toLowerCase() === A1)!;
    expect(a).toMatchObject({ label: 'Amara', verified: true, count: 2 });
    expect(a.perToken.usdc).toEqual({ sent: 1000000n, received: 1000000n });
    // A proven peer with no payment yet is listed too.
    expect(m.counterparties.find((c) => c.address === A2)).toMatchObject({ verified: true, count: 0 });
  });

  it('every event carries where it comes from', () => {
    const m = computeModel(base([act({ id: '1', kind: 'receive', txHash: '0xab' }), act({ id: '2', kind: 'faucet' })]));
    expect(m.events.find((e) => e.id === '1')!.provenance).toEqual(['local', 'proof', 'public']);
    expect(m.events.find((e) => e.id === '2')!.provenance).toEqual(['local']);
  });

  it('puts events in the right day of the 90-day chart and flags stuck ones', () => {
    const m = computeModel(base([act({ id: '1', kind: 'receive', createdAt: NOW }), act({ id: '2', kind: 'send', status: 'proving', createdAt: NOW - 2 * H })]));
    const today = m.days[m.days.length - 1];
    expect(today.in + m.days[m.days.length - 1].out).toBeGreaterThanOrEqual(1);
    expect(m.stuck).toBe(1);
  });

  it('ignores duplicated ids and malformed amounts', () => {
    const m = computeModel(base([act({ id: '1', kind: 'send' }), act({ id: '1', kind: 'send' }), act({ id: '2', kind: 'send', amount: '1e9' })]));
    expect(m.events).toHaveLength(2);
    expect(m.totals[0].count).toBe(1);
  });

  it('stays fast with ten thousand events', () => {
    const many: Activity[] = Array.from({ length: 10_000 }, (_, i) =>
      act({ id: String(i), kind: i % 2 ? 'send' : 'receive', counterparty: '0x' + (i % 300).toString(16).padStart(64, '0'), createdAt: NOW - i * 60_000 }),
    );
    const t0 = performance.now();
    const m = computeModel(base(many));
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(m.events).toHaveLength(10_000);
    expect(m.counterparties).toHaveLength(300);
  });
});

describe('filterEvents', () => {
  const m = computeModel(base([
    act({ id: '1', kind: 'send', counterparty: A1, createdAt: NOW - 40 * 24 * H }),
    act({ id: '2', kind: 'receive', counterparty: A2, txHash: '0xfeed' }),
    act({ id: '3', kind: 'shield', status: 'failed' }),
  ]));
  it('filters by direction, status, period and text', () => {
    expect(filterEvents(m.events, { ...NO_FILTER, direction: 'in' }, NOW).map((e) => e.id)).toEqual(['2']);
    expect(filterEvents(m.events, { ...NO_FILTER, direction: 'other' }, NOW).map((e) => e.id)).toEqual(['3']);
    expect(filterEvents(m.events, { ...NO_FILTER, status: 'failed' }, NOW).map((e) => e.id)).toEqual(['3']);
    expect(filterEvents(m.events, { ...NO_FILTER, since: 30 }, NOW).map((e) => e.id).sort()).toEqual(['2', '3']);
    expect(filterEvents(m.events, { ...NO_FILTER, q: 'FEED' }, NOW).map((e) => e.id)).toEqual(['2']);
  });
});

describe('alerts', () => {
  it('asks for Fee Juice on Alpha only, and always states the audit status', () => {
    const model = { stuck: 0, failedRecent: 0, inFlight: 0 };
    const low = { balance: 1n, minForTx: 10n, claims: [{ ready: true }] };
    expect(computeAlerts({ phase: 'ready', feeJuice: low, needsFeeJuice: true, receiveOnly: false, model }).map((a) => a.id)).toEqual(['fee-juice', 'claims', 'unaudited']);
    expect(computeAlerts({ phase: 'ready', needsFeeJuice: false, receiveOnly: true, model }).map((a) => a.id)).toEqual(['receive-only', 'unaudited']);
  });
});

describe('readBindings', () => {
  it('reads only addresses whose proof of control was verified', () => {
    const data: Record<string, string> = {
      'hl.aztec_peer.inboxA': A1,
      'hl.aztec_peer.verified:inboxA': A1,
      'hl.aztec_peer.inboxB': A2,
      'hl.aztec_peer.proof:inboxA': JSON.stringify({ address: A1 }),
      other: 'x',
    };
    const keys = Object.keys(data);
    const storage = { length: keys.length, key: (i: number) => keys[i], getItem: (k: string) => data[k] ?? null };
    expect(readBindings(storage)).toEqual([{ inboxId: 'inboxA', aztecAddress: A1 }]);
  });
});
