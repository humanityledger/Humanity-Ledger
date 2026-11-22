/**
 * Closing check of the closed cUSDC beta (docs/beta/CUSDC_BETA.md): every piece that has to hold
 * together, read from the code as merged. If one of these changes, the beta document must change too.
 */
import fs from 'node:fs';
import { CUSDC_GATES, cusdcReady } from '@/lib/payments/assets';
import { BETA_REASONS, MAX_BETA_TESTERS, cusdcBetaEntry, cusdcBetaProgram, cusdcBetaVisibility, recordedCusdc } from '@/lib/beta/cusdc-beta';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const record = JSON.parse(read('deployments/aztec-mainnet.json'));

describe('the switch', () => {
  it('ships off, for at most 100 people, with no end date', () => {
    expect(record.cusdcBeta).toEqual({ enabled: false, until: null, maxTesters: 100 });
    expect(MAX_BETA_TESTERS).toBe(100);
    expect(cusdcBetaProgram({ entry: cusdcBetaEntry(record), cusdc: recordedCusdc(record), cap: 1n, now: new Date() })).toEqual({ ok: false, reasons: [BETA_REASONS.off] });
  });
  it('the nine gates are untouched, so the public never sees cUSDC', () => {
    expect(CUSDC_GATES).toHaveLength(9);
    expect(CUSDC_GATES.every((g) => g.met === false)).toBe(true);
    expect(cusdcReady()).toBe(false);
  });
});

describe('technical checks the beta never skips', () => {
  it('the cUSDC contract must be confirmed on the network, even for members', () => {
    expect(recordedCusdc(record)?.verifiedOnChain).toBe(false);
    const member = { active: true, noticeVersion: 'cusdc-beta-notice-1' };
    expect(cusdcBetaVisibility({ entry: { enabled: true, until: '2999-01-01T00:00:00Z' }, cusdc: recordedCusdc(record), cap: 1n, now: new Date(), member })).toBe('hidden');
  });
  it('the preflight reports the wallet’s own token check for planned tokens', () => {
    expect(read('test/live/aztec-mainnet-preflight.live.test.ts')).toMatch(/planned \$\{p\.symbol\}: checkTokenInstance/);
  });
  it('a cap per payment is required by the beta and by every private payment on Alpha', () => {
    expect(cusdcBetaProgram({ entry: { enabled: true, until: '2999-01-01T00:00:00Z' }, cusdc: { symbol: 'cUSDC', address: '0x' + '1'.repeat(64), verifiedOnChain: true }, cap: null, now: new Date() }))
      .toEqual({ ok: false, reasons: [BETA_REASONS.noCap] });
    expect(read('lib/payments/direct-private.ts')).toMatch(/no amount cap configured for this token on mainnet/);
  });
  it('exits-only stops new payments without a deploy, before the beta check', () => {
    const client = read('lib/aztec/wallet/client.ts');
    expect(client).toMatch(/async send\(key: TokenKey, amount: string, to: string\) \{\n    await assertNewValueAllowed\(\);\n    await assertCusdcBetaAllows\(key\);/);
    expect(read('lib/aztec/value-mode.ts')).toMatch(/AZTEC_VALUE_MODE on the server, read at every new value action/);
  });
  it('the build refuses a cUSDC slot that is not the planned address', () => {
    expect(read('scripts/aztec/check-alpha-config.mjs')).toMatch(/is not the \$\{PLANNED_SLOTS\[slot\]\} address in plannedTokens/);
  });
});

describe('the pieces are wired', () => {
  it.each([
    'app/api/beta/cusdc/status/route.ts',
    'app/api/beta/cusdc/redeem/route.ts',
    'app/beta/page.tsx',
    'scripts/beta/cusdc-invites.mjs',
    'prisma/migrations/20261122150000_cusdc_beta/migration.sql',
    'lib/beta/cusdc-beta-client.ts',
    'components/chat/PaymentCard.tsx',
    'components/chat/PaymentRequestCard.tsx',
    'components/chat/PaymentRequestComposer.tsx',
    'components/chat/IncomingPaymentNotifier.tsx',
  ])('%s exists', (p) => {
    expect(fs.existsSync(p)).toBe(true);
  });
  it('the beta document covers the gates, the checks, and switching on and off', () => {
    const doc = read('docs/beta/CUSDC_BETA.md');
    for (const g of CUSDC_GATES) expect(doc, g.id).toContain(`\`${g.id}\``);
    for (const s of ['verifiedOnChain', 'NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS', 'NEXT_PUBLIC_AZTEC_TOKENS', 'AZTEC_VALUE_MODE', 'cusdcBeta.enabled', 'checkTokenInstance', 'Fee Juice']) {
      expect(doc, s).toContain(s);
    }
  });
});
