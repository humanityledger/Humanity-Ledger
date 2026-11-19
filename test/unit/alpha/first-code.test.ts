/** Package 3: what must be in place before the first invitation code. */
import fs from 'node:fs';
import { PAYMENT_REASONS, PAYMENT_STAGES, paymentReason } from '@/lib/aztec/wallet/payment-report';

describe('wallet payment events', () => {
  it('stages and reason codes are closed lists', () => {
    expect(PAYMENT_STAGES).toEqual(['attempted', 'sent', 'mined', 'unconfirmed', 'failed']);
    expect(paymentReason(new Error('No non-nullified L1 to L2 message found for message hash 0x12'))).toBe('claim_consumed');
    expect(paymentReason(new Error('User rejected the request'))).toBe('declined');
    expect(paymentReason(new Error('Assertion failed: balance too low'))).toBe('reverted');
    expect(paymentReason(new Error('fetch failed'))).toBe('network');
    expect(paymentReason('something new')).toBe('other');
    for (const r of PAYMENT_REASONS) expect(r).toMatch(/^[a-z_]+$/);
  });
  it('the wallet reports every stage of a send, and the server logs only codes', () => {
    const client = fs.readFileSync('lib/aztec/wallet/client.ts', 'utf8');
    for (const s of ['attempted', 'sent', 'mined', 'unconfirmed', 'failed']) expect(client).toContain(`reportPayment('${s}'`);
    const report = fs.readFileSync('lib/aztec/wallet/payment-report.ts', 'utf8');
    expect(report).not.toMatch(/txHash|amount:|address|message:/);
    const route = fs.readFileSync('app/api/wallet/payment-report/route.ts', 'utf8');
    expect(route).toMatch(/requireWallet/);
    expect(route).toMatch(/checkRateLimit/);
    expect(route).not.toMatch(/prisma|redis\.set/);
  });
});

describe('first-code readiness documents', () => {
  it('cron, terms procedure, rehearsal and checklist exist', () => {
    expect(fs.readFileSync('railway.purge.toml', 'utf8')).toMatch(/startCommand = "node scripts\/alpha\/purge\.mjs"/);
    expect(fs.readFileSync('railway.toml', 'utf8')).toMatch(/startCommand = "sh \.\/start\.sh"/);
    expect(fs.readFileSync('docs/alpha/TERMS_PUBLISHING.md', 'utf8')).toMatch(/sha256sum/);
    const list = fs.readFileSync('docs/alpha/FIRST_CODE_CHECKLIST.md', 'utf8').split('\n').filter((l) => /^\d+\. /.test(l));
    expect(list).toHaveLength(10);
    const rehearsal = fs.readFileSync('scripts/alpha/rehearse-invites-ci.mjs', 'utf8');
    expect(rehearsal).toMatch(/ALPHA_REHEARSAL !== '1'/);
    expect(rehearsal).toMatch(/localhost\|127/);
  });
});
