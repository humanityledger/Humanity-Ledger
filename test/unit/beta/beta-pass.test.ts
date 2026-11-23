/**
 * The hard beta gate: while the switch is on, /chat opens only for a signed-in beta member
 * (signed pass cookie checked against the session wallet), and the routes keep the pass in step
 * with membership. Also the Payments history CSV and the landing photos.
 */
import fs from 'node:fs';
import { BETA_PASS_COOKIE, betaGateOn, chatGateDecision, signBetaPass, verifyBetaPass } from '@/lib/beta/pass';
import { historyCsv } from '@/lib/payments/history-csv';
import record from '../../../deployments/aztec-mainnet.json';

const secret = new TextEncoder().encode('s'.repeat(40));
const W = '0x' + 'a'.repeat(40);

describe('the beta pass', () => {
  it('verifies only for the same wallet, the same secret and before it expires', async () => {
    const t = await signBetaPass(W, secret);
    expect(await verifyBetaPass(t, W.toUpperCase().replace('0X', '0x'), secret)).toBe(true);
    expect(await verifyBetaPass(t, '0x' + 'b'.repeat(40), secret)).toBe(false);
    expect(await verifyBetaPass(t, W, new TextEncoder().encode('x'.repeat(40)))).toBe(false);
    expect(await verifyBetaPass(t, null, secret)).toBe(false);
    expect(await verifyBetaPass(undefined, W, secret)).toBe(false);
    const old = await signBetaPass(W, secret, Date.now() - 13 * 3600_000);
    expect(await verifyBetaPass(old, W, secret)).toBe(false);
  });
  it('the gate follows the beta switch', () => {
    expect(betaGateOn(record)).toBe((record as { cusdcBeta: { enabled: boolean } }).cusdcBeta.enabled);
    expect(betaGateOn({ cusdcBeta: { enabled: false } })).toBe(false);
  });
  it('signed out to /connect, no pass to /beta, member through; off or harness open', () => {
    const base = { gateOn: true, harness: false, session: W, passOk: true };
    expect(chatGateDecision(base)).toBe('open');
    expect(chatGateDecision({ ...base, passOk: false })).toBe('beta');
    expect(chatGateDecision({ ...base, session: null, passOk: false })).toBe('connect');
    expect(chatGateDecision({ ...base, gateOn: false, session: null })).toBe('open');
    expect(chatGateDecision({ ...base, harness: true, session: null })).toBe('open');
  });
  it('is wired into the middleware and both beta routes', () => {
    const mw = fs.readFileSync('middleware.ts', 'utf8');
    expect(mw).toMatch(/if \(pathname === '\/chat' \|\| pathname\.startsWith\('\/chat\/'\)\) \{/);
    expect(mw).toMatch(/verifyBetaPass\(req\.cookies\.get\(BETA_PASS_COOKIE\)\?\.value, session, getEdgeSecret\(\)\)/);
    expect(fs.readFileSync('app/api/beta/cusdc/status/route.ts', 'utf8')).toMatch(/await applyBetaPass\(res, w, !!member\);/);
    expect(fs.readFileSync('app/api/beta/cusdc/redeem/route.ts', 'utf8')).toMatch(/if \(r\.status === 200\) await applyBetaPass\(res, who, true\);/);
    expect(BETA_PASS_COOKIE).toBe('hl_beta_pass');
    expect(fs.readFileSync('components/beta/BetaGateView.tsx', 'utf8')).not.toMatch(/Continue to messages/);
  });
});

describe('Settings > Payments history', () => {
  it('exports the wallet activity as CSV, newest first, without formula injection', () => {
    const csv = historyCsv([
      { createdAt: Date.UTC(2026, 10, 1), kind: 'send', amount: '5 cUSDC', status: 'settled', txHash: '0xab' },
      { createdAt: Date.UTC(2026, 10, 2), kind: 'receive', amount: '=HYPERLINK("x")', status: 'pending' },
    ]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('"Date","Type","Amount","Status","Transaction"');
    expect(lines[1]).toContain('"Received"');
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toBe('"2026-11-01T00:00:00.000Z","Sent","5 cUSDC","settled","0xab"');
  });
  it('the tab shows the real history instead of an empty local key', () => {
    const settings = fs.readFileSync('components/chat/LedgerSettingsFull.tsx', 'utf8');
    expect(settings).toMatch(/<PaymentHistory \/>/);
    expect(settings).not.toMatch(/ledger_tx_/);
  });
});

describe('landing photos', () => {
  it('use only the high-resolution photos, alternating', () => {
    const phones = fs.readFileSync('components/landing/site/Phones.tsx', 'utf8');
    expect(phones).not.toMatch(/photo: 'hand-wall/);
    const order = [...phones.matchAll(/photo: '(hand-[a-z-]+)'/g)].map((m) => m[1]);
    for (let i = 1; i < order.length; i++) expect(order[i].replace('-l', ''), order.join(',')).not.toBe(order[i - 1].replace('-l', ''));
  });
});
