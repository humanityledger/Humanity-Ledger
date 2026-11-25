/**
 * The dashboard sends nothing private anywhere (docs/DASHBOARD.md). Its own code has no network
 * call at all: the only traffic on the page is the wallet talking to the Aztec node and, when the
 * person reads it, the messaging client talking to XMTP, both unchanged from the chat.
 */
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { computeModel, filterEvents, NO_FILTER } from '@/lib/dashboard/model';

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

const SOURCES = [...files('lib/dashboard'), ...files('components/dashboard'), 'app/dashboard/page.tsx'].filter((f) => /\.(ts|tsx)$/.test(f));
const NETWORK = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|new\s+EventSource|\/api\/|axios|navigator\.share\s*\(|postMessage\s*\(\s*[^,)]*,\s*['"]\*['"]/;

describe('dashboard privacy', () => {
  it('has sources to check', () => expect(SOURCES.length).toBeGreaterThanOrEqual(6));

  for (const f of SOURCES) {
    it(`${f} makes no network call of its own`, () => {
      const src = fs.readFileSync(f, 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '');
      expect(src).not.toMatch(NETWORK);
    });
  }

  it('imports nothing that reports or logs to a server', () => {
    for (const f of SOURCES) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/from ['"]@\/lib\/(analytics|telemetry|monitoring|sentry|logger)/);
      expect(src, f).not.toMatch(/reportDelivery|reportError\(/);
    }
  });

  it('the worker reads only what the page hands it', () => {
    const w = fs.readFileSync('lib/dashboard/model.worker.ts', 'utf8');
    const imports = [...w.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports).toEqual(['./model']);
  });

  it('computing the model never touches the network', () => {
    const spy = vi.fn(() => {
      throw new Error('network used');
    });
    const g = globalThis as { fetch?: unknown };
    const saved = g.fetch;
    g.fetch = spy;
    try {
      const m = computeModel({
        activity: [{ id: '1', kind: 'send', token: 'usdc', amount: '5', counterparty: '0x' + '1'.repeat(64), status: 'settled', createdAt: Date.now() }],
        tokens: [{ key: 'usdc', symbol: 'cUSDC', decimals: 6 }],
        bindings: [],
        contacts: [],
        now: Date.now(),
      });
      filterEvents(m.events, NO_FILTER, Date.now());
    } finally {
      g.fetch = saved;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('the page is public in every gate, so it never redirects before the browser computes anything', () => {
    expect(fs.readFileSync('middleware.ts', 'utf8')).toMatch(/'\/dashboard'/);
    expect(fs.readFileSync('lib/routing/publicPages.ts', 'utf8')).toMatch(/'\/dashboard'/);
    expect(fs.readFileSync('components/layout/TitaniumGate.tsx', 'utf8')).toMatch(/'\/dashboard'/);
  });

  it('removing wallet data closes the wallet before deleting its stores', () => {
    const src = fs.readFileSync('components/dashboard/DashboardApp.tsx', 'utf8');
    const wipe = src.slice(src.indexOf('const wipe = async'));
    expect(wipe.indexOf('disconnect()')).toBeLessThan(wipe.indexOf('wipeLocalAztecStores()'));
  });
});
