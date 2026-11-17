/**
 * The private wallet screen's rules (components/zk/wallet/walletLogic.ts) and the
 * promises its source must keep: Fee Juice is public, no audit is claimed, and every
 * action calls the wallet itself.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  activityAmount, amountProblem, cleanAmount, dayLabel, feeRunway, filterActivity, groupByDay, isInbound, recipientProblem,
} from '@/components/zk/wallet/walletLogic';

const ADDR = '0x1f49571a48699da4e70e1b7dbc5afcea5bb712f7b2cfaf432353e694851e24e5';

describe('amounts', () => {
  it('keeps digits and one point, and no more decimals than the token has', () => {
    expect(cleanAmount('1,5', 6)).toBe('1.5');
    expect(cleanAmount('12.3456789', 6)).toBe('12.345678');
    expect(cleanAmount('1.2.3', 6)).toBe('1.23');
    expect(cleanAmount('007', 6)).toBe('7');
    expect(cleanAmount('abc', 6)).toBe('');
  });
  it('says when an amount cannot be paid, and nothing for an empty field', () => {
    expect(amountProblem('', 6, 10n)).toBeNull();
    expect(amountProblem('0', 6, 10n)).toBe('The amount must be greater than zero.');
    expect(amountProblem('2', 6, 1_000_000n)).toBe('More than you have');
    expect(amountProblem('1', 6, 1_000_000n)).toBeNull();
    expect(amountProblem('0.0000001', 6, 10n)).toBe('This token has 6 decimal places.');
  });
});

describe('recipient', () => {
  it('must be an Aztec address and not your own', () => {
    expect(recipientProblem('')).toBeNull();
    expect(recipientProblem('0x1234')).toBe('An Aztec address is 0x and 64 characters');
    expect(recipientProblem('0x812daf0000000000000000000000000000f0d1ea')).toBe('An Aztec address is 0x and 64 characters');
    expect(recipientProblem(ADDR, ADDR.toUpperCase().replace('0X', '0x'))).toBe('This is your own address');
    expect(recipientProblem(ADDR, '0x' + '0'.repeat(64))).toBeNull();
  });
});

describe('Fee Juice runway', () => {
  it('counts whole transactions at the most a transaction can cost', () => {
    expect(feeRunway(16_893_587_811_535_000_000n, 1_438_000_000_000_000_000n)).toBe(11);
    expect(feeRunway(1n, 2n)).toBe(0);
    expect(feeRunway(10n ** 30n, 1n)).toBe(999);
    expect(feeRunway(undefined, 1n)).toBeNull();
    expect(feeRunway(1n, 0n)).toBeNull();
  });
});

describe('activity', () => {
  const now = new Date('2026-11-17T14:00:00').getTime();
  const items: any[] = [
    { id: '1', kind: 'send', status: 'settled', createdAt: now - 3600e3, amount: '100000', token: 'X' },
    { id: '2', kind: 'receive', status: 'settled', createdAt: now - 26 * 3600e3 },
    { id: '3', kind: 'send', status: 'pending', createdAt: now - 60e3 },
    { id: '4', kind: 'unshield', status: 'failed', createdAt: now - 5 * 86400e3 },
    { id: '5', kind: 'shield', status: 'settled', createdAt: now - 2 * 3600e3 },
  ];
  it('filters money in, money out, and what is not settled', () => {
    expect(filterActivity(items, 'in').map((a) => a.id)).toEqual(['2']);
    expect(filterActivity(items, 'out').map((a) => a.id)).toEqual(['1', '3', '4']);
    expect(filterActivity(items, 'pending').map((a) => a.id)).toEqual(['3', '4']);
    expect(filterActivity(items, 'all')).toHaveLength(5);
    expect(isInbound(items[4])).toBe(false);
  });
  it('groups by day, newest first', () => {
    const g = groupByDay(items, now);
    expect(g.map((x) => x.day).slice(0, 2)).toEqual(['Today', 'Yesterday']);
    expect(g[0].items.map((a) => a.id)).toEqual(['3', '1', '5']);
    expect(dayLabel(now, now)).toBe('Today');
  });
  it('an entry without a token shows no amount', () => {
    expect(activityAmount(items[1])).toBe('');
  });
});

describe('the wallet screen keeps its promises', () => {
  const src = ['components/zk/ZkWalletPanel.tsx', 'components/zk/wallet/WalletUI.tsx', 'components/zk/wallet/WalletSheets.tsx', 'components/zk/wallet/WalletActivity.tsx']
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
  it('says the fee is public and the payment is not, and claims no audit', () => {
    expect(src).toContain('Paid by your account. The fee is public; the amount, you and the recipient are not.');
    expect(src).not.toMatch(/(has been|was|is) (externally )?audited|audited by|audit (passed|complete)/i);
    expect(src).not.toMatch(/Fee Juice is private|private fee/i);
  });
  it('every action calls the wallet, and Send asks for a review first', () => {
    const sheets = fs.readFileSync('components/zk/wallet/WalletSheets.tsx', 'utf8');
    expect(sheets).toMatch(/await wallet\.send\(token, amount, to\)/);
    expect(sheets).toMatch(/await wallet\.shield\(token, amount\)/);
    expect(sheets).toMatch(/await wallet\.unshield\(token, amount\)/);
    expect(sheets).toMatch(/await wallet\.addSender\(sender\)/);
    expect(sheets).toContain('Check the address. A payment cannot be reversed.');
    const review = sheets.indexOf("if (step === 'review')");
    expect(sheets.indexOf('await wallet.send(')).toBeLessThan(review);
    expect(sheets.slice(review)).toMatch(/onClick=\{submit\}/);
  });
  it('the sheet is a modal dialog that Escape closes', () => {
    const ui = fs.readFileSync('components/zk/wallet/WalletUI.tsx', 'utf8');
    expect(ui).toMatch(/role="dialog"\s*aria-modal="true"/);
    expect(ui).toMatch(/if \(e\.key === 'Escape'\)/);
  });
  it('hiding amounts is local to this browser and changes only what is drawn', () => {
    const ui = fs.readFileSync('components/zk/wallet/WalletUI.tsx', 'utf8');
    expect(ui).toContain("const HIDE_KEY = 'hl.wallet.hide_amounts';");
  });
});
