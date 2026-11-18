/** IR-03 (internal security review, 18 November 2026): a comma never changes the amount. */
import { describe, expect, it } from 'vitest';
import { parseUnits } from '@/lib/aztec/wallet/amounts';

describe('parseUnits and locale separators', () => {
  it('refuses "1,5" instead of reading it as 15', () => {
    expect(() => parseUnits('1,5', 6)).toThrow(/dot for decimals/);
  });
  it('refuses thousand separators instead of guessing them', () => {
    expect(() => parseUnits('1,000', 6)).toThrow(/dot for decimals/);
    expect(() => parseUnits('1,000.5', 6)).toThrow(/dot for decimals/);
  });
  it('still reads dot decimals exactly', () => {
    expect(parseUnits('1.5', 6)).toBe(1_500_000n);
    expect(parseUnits(' 1000 ', 6)).toBe(1_000_000_000n);
  });
});
