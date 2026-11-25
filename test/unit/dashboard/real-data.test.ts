/**
 * The dashboard's normal path shows this account's own data and nothing else: no made-up account,
 * amount, person or activity can reach it. The made-up account exists only behind ?example=1,
 * through lib/dashboard/sources.ts, and the page labels it.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { accountFor, dataMode, modelInputs, walletIsFor, walletView } from '@/lib/dashboard/sources';
import { EXAMPLE_ACCOUNT, EXAMPLE_PEOPLE, EXAMPLE_TOKENS } from '@/lib/dashboard/example';
import { computeModel } from '@/lib/dashboard/model';

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? `${x}n` : x));

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name === 'node_modules' || d.name.startsWith('.')) return [];
    return d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)];
  });
}
const code = (f: string) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** A storage holding what this browser would hold: one verified binding, and unrelated keys. */
function storage(entries: Record<string, string>) {
  const keys = Object.keys(entries);
  return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => entries[k] ?? null };
}

const ME = '0x00000000000000000000000000000000000000aa';
const PEER = '0x' + '2'.repeat(64);
const idle = { phase: 'idle', busy: false, balances: [], activity: [] };

describe('which data the page draws', () => {
  it('is the example only for exactly ?example=1', () => {
    expect(dataMode('?example=1')).toBe('example');
    expect(dataMode('?tab=1&example=1')).toBe('example');
    for (const q of ['', '?', '?example', '?example=', '?example=0', '?example=true', '?example=yes', '?example=1%20', '?Example=1', '?examples=1', '#example=1']) {
      expect(dataMode(q), q).toBe('live');
    }
  });
});

describe('the live path holds nothing made up', () => {
  it('signed out means no account, never a stand-in', () => {
    expect(accountFor('live', null)).toBe('');
    expect(accountFor('live', undefined)).toBe('');
    expect(accountFor('live', '')).toBe('');
    expect(accountFor('live', ME)).toBe(ME);
  });

  it('draws the private wallet’s own state object, unchanged', () => {
    const live = { phase: 'ready', busy: false, aztecAddress: '0x' + '3'.repeat(64), balances: [], activity: [] };
    expect(walletView('live', live, Date.now())).toBe(live);
    expect(walletView('live', idle, Date.now())).toBe(idle);
  });

  it('shows a wallet only when it was opened for this account', () => {
    expect(walletIsFor('live', ME, ME)).toBe(true);
    expect(walletIsFor('live', ME.toUpperCase().replace('0X', '0x'), ME)).toBe(true);
    expect(walletIsFor('live', '0x' + 'b'.repeat(40), ME)).toBe(false);
    expect(walletIsFor('live', null, ME)).toBe(false);
    expect(walletIsFor('live', ME, '')).toBe(false);
  });

  it('empty sources give an empty dashboard: no rows, no people, no totals', () => {
    const input = modelInputs('live', { activity: [], tokens: [], storage: undefined, contacts: [], now: Date.now() });
    expect(input.bindings).toEqual([]);
    expect(input.contacts).toEqual([]);
    const m = computeModel(input);
    expect(m.events).toEqual([]);
    expect(m.counterparties).toEqual([]);
    expect(m.totals).toEqual([]);
    expect(m.inFlight).toBe(0);
    expect(m.days.every((d) => d.in + d.out + d.other + d.failed === 0)).toBe(true);
  });

  it('only what the sources hold reaches the model', () => {
    const now = Date.now();
    const input = modelInputs('live', {
      activity: [{ id: 'a1', kind: 'send', token: 'CUSDC', amount: '2500000', counterparty: PEER, status: 'settled', createdAt: now - 60_000 } as any],
      tokens: [{ key: 'CUSDC', symbol: 'cUSDC', decimals: 6 }],
      storage: storage({ 'hl.aztec_peer.verified:inbox-1': PEER, 'hl.wallet.hide_amounts': '1', 'unrelated': '0x' + '9'.repeat(64) }),
      contacts: [{ peerAddress: PEER, name: 'Ana' }],
      now,
    });
    expect(input.bindings).toEqual([{ inboxId: 'inbox-1', aztecAddress: PEER }]);
    expect(input.contacts).toEqual([{ address: PEER, name: 'Ana' }]);
    const m = computeModel(input);
    expect(m.events.map((e) => e.id)).toEqual(['a1']);
    expect(m.counterparties.map((c) => c.address.toLowerCase())).toEqual([PEER]);
    expect(m.counterparties[0]).toMatchObject({ label: 'Ana', verified: true, count: 1 });
  });

  it('no example value appears in the live input or model, even with the example module loaded', () => {
    const now = Date.now();
    const input = modelInputs('live', { activity: [], tokens: [], storage: storage({}), contacts: [], now });
    const text = json(input) + json(computeModel(input)) + json(walletView('live', idle, now)) + accountFor('live', null);
    expect(text).not.toContain(EXAMPLE_ACCOUNT);
    expect(text).not.toMatch(/example-/);
    for (const p of EXAMPLE_PEOPLE) expect(text).not.toContain(p);
    for (const tk of EXAMPLE_TOKENS) expect(text).not.toContain(String(tk.privateUnits));
  });
});

describe('the example stays behind ?example=1', () => {
  it('replaces every account value, including a real session’s', () => {
    expect(accountFor('example', ME)).toBe(EXAMPLE_ACCOUNT);
    const v = walletView('example', { ...idle, error: 'x', step: 'y' } as any, Date.now());
    expect(v.phase).toBe('ready');
    expect(v.balances).toEqual(EXAMPLE_TOKENS);
    expect(v.activity.length).toBeGreaterThan(100);
    expect((v as any).error).toBeUndefined();
    const input = modelInputs('example', { activity: v.activity, tokens: [], storage: storage({ 'hl.aztec_peer.verified:me': PEER }), contacts: [{ peerAddress: PEER, name: 'Real' }], now: Date.now() });
    expect(json(input)).not.toContain(PEER);
  });

  it('nothing but lib/dashboard/sources.ts imports the example module', () => {
    const app = [...files('components'), ...files('lib'), ...files('app'), ...files('hooks')].filter((f) => /\.(ts|tsx)$/.test(f));
    const norm = (f: string) => f.split(path.sep).join('/');
    const importers = app.filter((f) => {
      const src = code(f);
      return /from\s+['"][^'"]*dashboard\/example['"]/.test(src) || (norm(f).startsWith('lib/dashboard/') && /from\s+['"]\.\/example['"]/.test(src));
    });
    expect(importers.map(norm)).toEqual(['lib/dashboard/sources.ts']);
  });

  it('the dashboard components hold no account, address, amount or name of their own', () => {
    for (const f of files('components/dashboard').filter((x) => /\.tsx?$/.test(x))) {
      const src = code(f);
      expect(src, f).not.toMatch(/0x[0-9a-fA-F]{6,}/);
      expect(src, f).not.toMatch(/\b(?!0n\b)\d[\d_]*n\b/);
      expect(src, f).not.toMatch(/EXAMPLE_(ACCOUNT|TOKENS|PEOPLE|NAMES)|example(Activity|WalletState|Bindings|Contacts)|e4a3c1/);
      expect(src, f).not.toMatch(/['"](Amara|Jonas|Lucía|Mei|Oskar|Priya|Tomás|Yuki|Nadia|Felix|Inés|Ravi)['"]/);
    }
  });

  it('the page says “example” wherever it draws one', () => {
    const src = code('components/dashboard/DashboardApp.tsx');
    expect(src).toMatch(/example \? \(\s*<p className=\{s\.notice\} role="note">\s*<strong>\{t\('Example data\.'\)\}<\/strong>\{' '\}\s*\{t\('A made-up account[^']*Nothing here is yours, and nothing is read from a network or from your device\.'\)\}/);
    // No live line for the example: nothing is read, so nothing pretends to be live.
    expect(src).toMatch(/if \(mode === 'example'\) return null;/);
    expect(src).toMatch(/t\('Example account with made-up data'\)/);
    // The notice sits above the sections, so every tab shows it.
    expect(src.indexOf('{notices}')).toBeLessThan(src.indexOf('role="tablist"'));
  });
});
