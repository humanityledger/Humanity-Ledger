/** Package 5: every Fee Juice grant is recorded, checked on the network and within the budget. */
import fs from 'node:fs';
import { grantProblem, grantsCsv, parseBudget } from '@/lib/alpha/fee-juice-grants';

const E18 = 10n ** 18n;
const g = { recipientAztecAddress: '0x' + 'ab'.repeat(32), amount: '20', txHash: '0x' + 'cd'.repeat(32), network: 'l1' as const, marketValueEur: '12.40', valueSource: 'CoinGecko AZTEC/EUR close 19/11/2026' };

describe('Fee Juice grants (OD-9)', () => {
  it('without a budget, nothing is recorded (D-4 default)', () => {
    expect(parseBudget(undefined)).toBeNull();
    expect(parseBudget('')).toBeNull();
    expect(parseBudget('0')).toBeNull();
    expect(grantProblem(g, null, 0n)).toMatch(/No Fee Juice budget/);
  });
  it('within the budget it is accepted; beyond it, refused', () => {
    const budget = parseBudget('1000')!;
    expect(budget).toBe(1000n * E18);
    expect(grantProblem(g, budget, 0n)).toBeNull();
    expect(grantProblem(g, budget, 990n * E18)).toMatch(/exceed the budget/);
  });
  it('refuses incomplete grants', () => {
    const b = 1000n * E18;
    expect(grantProblem({ ...g, recipientAztecAddress: '0x12' }, b, 0n)).toMatch(/recipient/);
    expect(grantProblem({ ...g, amount: '-1' }, b, 0n)).toMatch(/amount/);
    expect(grantProblem({ ...g, txHash: 'nope' }, b, 0n)).toMatch(/txHash/);
    expect(grantProblem({ ...g, network: 'l3' as any }, b, 0n)).toMatch(/network/);
    expect(grantProblem({ ...g, marketValueEur: '1.234' }, b, 0n)).toMatch(/euros/);
    expect(grantProblem({ ...g, valueSource: '' }, b, 0n)).toMatch(/valueSource/);
  });
  it('the CSV has one line per grant, oldest first, quoted where needed', () => {
    const rows = [
      { ...g, grantedAt: new Date('2026-11-21T10:00:00Z'), block: 2, valueSource: 'index, "close"' },
      { ...g, grantedAt: new Date('2026-11-20T10:00:00Z'), block: 1 },
    ];
    const csv = grantsCsv(rows).trim().split('\n');
    expect(csv[0]).toBe('granted_at,recipient_aztec_address,amount_aztec,network,tx_hash,block,market_value_eur,value_source');
    expect(csv[1]).toContain(',1,12.40,');
    expect(csv[2]).toContain('"index, ""close"""');
  });
  it('the route is admin only, reads the network without sending anything, and the migration is additive', () => {
    const route = fs.readFileSync('app/api/alpha/fee-juice-grants/route.ts', 'utf8');
    expect(route).toMatch(/parseAlphaAdmins\(process\.env\.ALPHA_ADMINS\)/);
    expect(route).toMatch(/eth_getTransactionReceipt/);
    expect(route).toMatch(/node_getTxReceipt/);
    expect(route).not.toMatch(/eth_sendRawTransaction|node_sendTx|privateKey|PRIVATE_KEY/);
    const sql = fs.readFileSync('prisma/migrations/20261119150000_fee_juice_grants/migration.sql', 'utf8');
    expect(sql).toMatch(/CREATE TABLE "FeeJuiceGrant"/);
    expect(sql).not.toMatch(/DROP|DELETE|ALTER TABLE/i);
  });
});
