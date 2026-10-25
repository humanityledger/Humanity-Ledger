/**
 * Exact conversion between what a person types ("12.5") and token base units
 * (12500000n for 6 decimals). No floating point anywhere: a payment amount is
 * never allowed to drift by a rounding error.
 */

const AMOUNT_RE = /^(\d+)(?:\.(\d+))?$/;

export function parseUnits(input: string, decimals: number): bigint {
  const clean = input.trim().replace(/,/g, '');
  const m = AMOUNT_RE.exec(clean);
  if (!m) throw new Error('Enter an amount such as 10 or 0.5.');
  const whole = m[1];
  const frac = m[2] ?? '';
  if (frac.length > decimals) throw new Error(`This token has ${decimals} decimal places.`);
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals) || '0');
  if (units <= 0n) throw new Error('The amount must be greater than zero.');
  // Aztec token balances are u128.
  if (units >= 2n ** 128n) throw new Error('That amount is too large.');
  return units;
}

export function formatUnits(units: bigint, decimals: number, maxFraction = 6): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, '0').slice(0, Math.min(decimals, maxFraction));
  frac = frac.replace(/0+$/, '');
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${wholeStr}${frac ? '.' + frac : ''}`;
}
