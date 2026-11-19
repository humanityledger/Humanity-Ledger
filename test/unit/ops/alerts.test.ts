/** Package 6: alerts from measured data, a status that shows only what was measured. */
import fs from 'node:fs';
import { alphaAlerts } from '@/lib/ops/alerts';

const none = { payments: {}, delivery: {}, nodeStalledSeconds: 0 };

describe('alpha alerts', () => {
  it('no data, no alert; a node that does not answer is an alert', () => {
    expect(alphaAlerts(none)).toEqual([]);
    expect(alphaAlerts({ ...none, nodeStalledSeconds: null }).map((a) => a.key)).toEqual(['node_unreachable']);
  });
  it('payment failures above 10 % of at least 5 attempts', () => {
    expect(alphaAlerts({ ...none, payments: { attempted: 4, failed: 4 } })).toEqual([]);
    expect(alphaAlerts({ ...none, payments: { attempted: 10, failed: 1 } })).toEqual([]);
    expect(alphaAlerts({ ...none, payments: { attempted: 10, failed: 2 } }).map((a) => a.key)).toEqual(['payment_failures']);
  });
  it('send failures above 5 % of at least 20 reports', () => {
    expect(alphaAlerts({ ...none, delivery: { send_published: 19, send_failed: 1 } })).toEqual([]);
    expect(alphaAlerts({ ...none, delivery: { send_published: 18, send_failed: 1, publish_gave_up: 1 } }).map((a) => a.key)).toEqual(['delivery_failures']);
  });
  it('a node stalled for more than 10 minutes', () => {
    expect(alphaAlerts({ ...none, nodeStalledSeconds: 600 })).toEqual([]);
    expect(alphaAlerts({ ...none, nodeStalledSeconds: 601 }).map((a) => a.key)).toEqual(['node_stalled']);
  });
});

describe('measured status only', () => {
  it('counters hold codes and hours, never an account', () => {
    const c = fs.readFileSync('lib/ops/counters.ts', 'utf8');
    expect(c).toMatch(/`ops:\$\{group\}:\$\{code\}:\$\{hour\}`/);
    expect(c).not.toMatch(/wallet|address|inbox/i);
  });
  it('the payment route counts only Alpha; the delivery route counts only production', () => {
    expect(fs.readFileSync('app/api/wallet/payment-report/route.ts', 'utf8')).toMatch(/if \(network === 'mainnet'\)/);
    expect(fs.readFileSync('app/api/chat/delivery-report/route.ts', 'utf8')).toMatch(/env === 'production' && kind !== 'other'/);
  });
  it('the page and the API show measurements, no uptime or target claims', () => {
    for (const f of ['app/status/page.tsx', 'app/api/status/alpha/route.ts']) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src).not.toMatch(/uptime|99\.9|SLA|guarantee/i);
    }
    expect(fs.readFileSync('app/status/page.tsx', 'utf8')).toMatch(/at most one report of each kind per minute per page/);
  });
  it('the alert workflow fails on any alert and writes nothing', () => {
    const wf = fs.readFileSync('.github/workflows/alpha-alerts.yml', 'utf8');
    expect(wf).toMatch(/contents: read/);
    expect(wf).toMatch(/if \[ "\$n" -gt 0 \]/);
  });
  it('the incident procedure has its first drill recorded', () => {
    const doc = fs.readFileSync('docs/alpha/INCIDENT.md', 'utf8');
    expect(doc).toMatch(/### Drill 1: tabletop, 19\/11\/2026/);
    expect(doc).toMatch(/AZTEC_VALUE_MODE=exits-only/);
  });
});
