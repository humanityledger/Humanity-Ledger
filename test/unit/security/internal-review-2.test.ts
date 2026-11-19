/** Package 7: the fixes of internal security review 2 (docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-19.md). */
import fs from 'node:fs';
import { grantsCsv } from '@/lib/alpha/fee-juice-grants';
import { assertClosedAlphaAllows } from '@/lib/alpha/gate-client';

const read = (f: string) => fs.readFileSync(f, 'utf8');

describe('internal review 2', () => {
  it('R2-1: opening an agreement on Alpha asks the server gate, twice; exits and accepting do not', () => {
    const src = read('lib/aztec/chat-agreements.ts');
    expect(src.match(/await assertClosedAlphaAllows\(AZTEC_WALLET_CONFIG\.network/g)).toHaveLength(2);
    const open = src.slice(src.indexOf('export async function openChatAgreement'), src.indexOf('export async function acceptChatAgreement'));
    expect(open).toContain('assertClosedAlphaAllows');
    expect(src.slice(src.indexOf('export async function acceptChatAgreement'))).not.toContain('assertClosedAlphaAllows');
    const route = read('app/api/alpha/gate/route.ts');
    expect(route).toMatch(/closedAlphaDecision\(/);
    expect(route).toMatch(/getVerifiedCaller/);
  });
  it('R2-1: the client fails closed and skips the test network', async () => {
    await expect(assertClosedAlphaAllows('testnet', '0x1', async () => { throw new Error('never'); })).resolves.toBeUndefined();
    await expect(assertClosedAlphaAllows('mainnet', '0x1', async () => { throw new Error('down'); })).rejects.toThrow(/Nothing was sent/);
    const answer = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
    await expect(assertClosedAlphaAllows('mainnet', '0x1', answer(200, { ok: false, reasons: ['The closed alpha is not open.'] }) as any)).rejects.toThrow(/not open\. Nothing was sent/);
    await expect(assertClosedAlphaAllows('mainnet', '0x1', answer(500, { ok: true }) as any)).rejects.toThrow();
    await expect(assertClosedAlphaAllows('mainnet', '0x1', answer(200, { ok: true }) as any)).resolves.toBeUndefined();
  });
  it('R2-2 and R2-3: redemption and grants run under an advisory lock', () => {
    expect(read('app/api/alpha/redeem/route.ts')).toMatch(/pg_advisory_xact_lock\(72707370\)/);
    const g = read('app/api/alpha/fee-juice-grants/route.ts');
    expect(g).toMatch(/pg_advisory_xact_lock\(72707371\)/);
    expect(g).toMatch(/'P2002'/);
  });
  it('R2-4: CSV cells that a spreadsheet would run as formulas are neutralised', () => {
    const csv = grantsCsv([{ grantedAt: new Date('2026-11-19T00:00:00Z'), recipientAztecAddress: '0xabc', amount: '1', network: 'l2', txHash: '0x1', block: 1, marketValueEur: '0.10', valueSource: '=HYPERLINK("x")' } as any]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });
  it('R2-5: the pre-deploy matches only a single-key advisory lock', () => {
    expect(read('scripts/railway-pre-deploy.js').match(/l\.classid = 0 AND l\.objid = 72707369 AND l\.objsubid = 1/g)).toHaveLength(2);
  });
  it('R2-7: /alpha hashes the bytes served', () => {
    const p = read('app/alpha/page.tsx');
    expect(p).toMatch(/x\.arrayBuffer\(\)/);
    expect(p).not.toMatch(/new TextEncoder\(\)\.encode\(text\)/);
  });
  it('the reports say what they are, and no audit is claimed', () => {
    expect(read('docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-19.md')).toMatch(/It is not an audit/);
    expect(read('docs/audit/EXTERNAL_REVIEW_PACKAGE.md')).toMatch(/No external audit or external review of Ledger Chat exists/);
    expect(JSON.parse(read('deployments/aztec-mainnet.json')).audit).toBeNull();
  });
});
