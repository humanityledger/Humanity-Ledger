import { describe, expect, it } from 'vitest';
import { formatAmount, formatElapsed, spokenDuration, toAmount, toDisplayName, toTokenSymbol } from '@/lib/activities/values';

describe('activity values: nothing but a short name and an amount reaches the island', () => {
  it('a display name is one short line', () => {
    expect(toDisplayName('Ana Ruiz')).toBe('Ana Ruiz');
    expect(toDisplayName('  Ana\n\tRuiz  ')).toBe('Ana Ruiz');
    expect(toDisplayName('')).toBe('Unknown');
    expect(toDisplayName(null)).toBe('Unknown');
    const long = toDisplayName('a'.repeat(200));
    expect(Array.from(long)).toHaveLength(32);
    expect(long.endsWith('…')).toBe(true);
  });

  it('a pasted message cannot pass as a name: it is cut to 32 characters on one line', () => {
    const body = 'Hi, the code for the door is 4471.\nCall me when you get here, I will be on the second floor.';
    const name = toDisplayName(body);
    expect(name).not.toContain('\n');
    expect(Array.from(name).length).toBeLessThanOrEqual(32);
    expect(name).not.toContain('second floor');
  });

  it('control and bidi-override characters are removed', () => {
    expect(toDisplayName('Ana‮gnp.exe')).toBe('Ana gnp.exe');
    expect(toDisplayName('A\u0000B C')).toBe('A B C');
  });

  it('token symbols are 1 to 8 upper-case letters or digits', () => {
    expect(toTokenSymbol('hlc')).toBe('HLC');
    expect(toTokenSymbol('USDC')).toBe('USDC');
    expect(toTokenSymbol('')).toBeNull();
    expect(toTokenSymbol('TOOLONGSYM')).toBeNull();
    expect(toTokenSymbol('H L C')).toBeNull();
  });

  it('amounts are plain positive decimals', () => {
    expect(toAmount('12.50', 'HLC')).toEqual({ value: '12.5', symbol: 'HLC' });
    expect(toAmount('0007', 'HLC')).toEqual({ value: '7', symbol: 'HLC' });
    expect(toAmount(25, 'usdc')).toEqual({ value: '25', symbol: 'USDC' });
    expect(toAmount('0', 'HLC')).toBeNull();
    expect(toAmount('0.000', 'HLC')).toBeNull();
    expect(toAmount('-3', 'HLC')).toBeNull();
    expect(toAmount('1e9', 'HLC')).toBeNull();
    expect(toAmount('12', 'not a symbol')).toBeNull();
    expect(toAmount('1.' + '1'.repeat(19), 'HLC')).toBeNull();
  });

  it('formats amounts and durations', () => {
    expect(formatAmount({ value: '1234567.25', symbol: 'HLC' } as never)).toBe('1,234,567.25 HLC');
    expect(formatElapsed(42_000)).toBe('0:42');
    expect(formatElapsed(252_000)).toBe('4:12');
    expect(formatElapsed(3_729_000)).toBe('1:02:09');
    expect(spokenDuration(252_000)).toBe('4 minutes 12 seconds');
    expect(spokenDuration(61_000)).toBe('1 minute 1 second');
    expect(spokenDuration(0)).toBe('0 seconds');
  });
});
