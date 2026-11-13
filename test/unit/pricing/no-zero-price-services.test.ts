import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { knownPrice, knownUsd, priceStatus, sumKnown, valueOrNull } from '@/lib/pricing/known-price';

describe('a missing price is unavailable, never 0 (F-09b)', () => {
  it('knows a price only when it is finite and above zero', () => {
    for (const bad of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, '', 'abc', '0', {}]) expect(knownPrice(bad)).toBeNull();
    expect(knownPrice(2.5)).toBe(2.5);
    expect(knownPrice('3.1')).toBe(3.1);
    expect(knownUsd('0')).toBe(0);
    expect(knownUsd(-2)).toBeNull();
  });

  it('values a holding only with a price, and a zero balance at exactly 0', () => {
    expect(valueOrNull(10, null)).toBeNull();
    expect(valueOrNull(0, null)).toBe(0);
    expect(valueOrNull(2, 3)).toBe(6);
    expect(priceStatus(null)).toBe('unavailable');
    expect(priceStatus(1)).toBe('priced');
  });

  it('sums only known values and says when the total is partial', () => {
    expect(sumKnown([{ v: 1 }, { v: null }, { v: 2 }], (x) => x.v)).toEqual({ total: 3, unpriced: 1, partial: true });
    expect(sumKnown([{ v: 1 }], (x) => x.v)).toEqual({ total: 1, unpriced: 0, partial: false });
  });

  it('PortfolioService and MoralisService turn no missing price into 0', () => {
    for (const f of ['lib/blockchain/PortfolioService.ts', 'lib/blockchain/MoralisService.ts']) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
      expect(src, f).not.toMatch(/\?\.price \|\| 0/);
      expect(src, f).not.toMatch(/\?\.price \?\? 0/);
      expect(src, f).not.toMatch(/usdPrice: 0/);
      expect(src, f).not.toMatch(/parseFloat\(t\.usd_price \|\| '0'\)/);
      expect(src, f).toMatch(/from '@\/lib\/pricing\/known-price'/);
    }
  });
});
