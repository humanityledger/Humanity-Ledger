import { describe, it, expect } from 'vitest';
import { BPS, U128_MAX, ceilBps, minimumAmount, protocolFee, validSchedule, type FeeSchedule } from '@/lib/protocol/fees';
import { agreementFee } from '@/lib/protocol/tokenomics';

// Example schedules for tests only. The live values are a decision still open
// (docs/protocol/FEE_CONTRACT_SPEC.md, "Decisions before deployment").
const S: FeeSchedule = { feeBps: 30n, minFee: 500n, maxFeeShareBps: 500n };
const NO_MIN: FeeSchedule = { feeBps: 30n, minFee: 0n, maxFeeShareBps: BPS };

// Deterministic pseudo-random bigints, so a failure reproduces.
function* lcg(seed: bigint) {
  let x = seed;
  for (;;) {
    x = (x * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    yield x;
  }
}
function amounts(n: number, seed = 7n): bigint[] {
  const g = lcg(seed);
  const out: bigint[] = [1n, 2n, 9_999n, 10_000n, 10_001n, 333_333n, U128_MAX, U128_MAX - 1n];
  for (let i = 0; i < n; i++) {
    const a = g.next().value as bigint;
    const b = g.next().value as bigint;
    out.push(((a << 64n) | b) % U128_MAX + 1n, (a % 1_000_000_000_000n) + 1n);
  }
  return out;
}

describe('ceilBps', () => {
  it('equals ceil(amount × bps / BPS) for every amount tried, without exceeding u128 on the way', () => {
    for (const a of amounts(2000)) {
      for (const bps of [0n, 1n, 30n, 9_999n, BPS]) {
        expect(ceilBps(a, bps)).toBe((a * bps + BPS - 1n) / BPS);
        // Largest intermediate of the u128-safe form.
        expect((a / BPS) * bps <= U128_MAX).toBe(true);
      }
    }
  });
  it('the direct product overflows u128 at the top of the range, which is why the contract must not use it', () => {
    expect(U128_MAX * 30n > U128_MAX).toBe(true);
  });
});

describe('protocolFee', () => {
  it('matches the formula of docs/TOKENOMICS.md and the existing agreementFee', () => {
    for (const a of amounts(500)) {
      const q = protocolFee(a, NO_MIN);
      expect(q.ok).toBe(true);
      if (q.ok) {
        expect(q.fee).toBe(agreementFee(a, NO_MIN.feeBps, NO_MIN.minFee));
        expect(q.fee + q.net).toBe(a);
      }
    }
  });
  it('splitting a payment never pays less in total', () => {
    for (const a of amounts(500)) {
      if (a < 2n) continue;
      const half = a / 2n;
      const whole = protocolFee(a, NO_MIN);
      const p1 = protocolFee(half, NO_MIN);
      const p2 = protocolFee(a - half, NO_MIN);
      if (whole.ok && p1.ok && p2.ok) expect(p1.fee + p2.fee >= whole.fee).toBe(true);
    }
  });
  it('is monotonic in the amount', () => {
    let prev = 0n;
    for (let a = 1n; a <= 50_000n; a += 97n) {
      const q = protocolFee(a, NO_MIN);
      if (q.ok) { expect(q.fee >= prev).toBe(true); prev = q.fee; }
    }
  });
  it('applies the minimum, and refuses when the minimum would take more than the allowed share (T-5)', () => {
    expect(protocolFee(10n, S)).toEqual({ ok: false, reason: 'fee-exceeds-share' });
    expect(protocolFee(10_000n, S)).toEqual({ ok: true, fee: 500n, net: 9_500n }); // 500 = 5% exactly
    expect(protocolFee(9_999n, S)).toEqual({ ok: false, reason: 'fee-exceeds-share' });
    expect(protocolFee(1_000_000n, S)).toEqual({ ok: true, fee: 3_000n, net: 997_000n });
  });
  it('the fee never exceeds the amount, the net is never negative', () => {
    for (const a of amounts(500)) {
      for (const s of [S, NO_MIN, { feeBps: BPS, minFee: 0n, maxFeeShareBps: BPS }]) {
        const q = protocolFee(a, s);
        if (q.ok) { expect(q.fee <= a).toBe(true); expect(q.net >= 0n).toBe(true); }
      }
    }
  });
  it('rejects invalid amounts and schedules', () => {
    expect(protocolFee(0n, S)).toEqual({ ok: false, reason: 'invalid-amount' });
    expect(protocolFee(-1n, S)).toEqual({ ok: false, reason: 'invalid-amount' });
    expect(protocolFee(U128_MAX + 1n, S)).toEqual({ ok: false, reason: 'invalid-amount' });
    expect(protocolFee(1_000n, { ...S, feeBps: BPS + 1n })).toEqual({ ok: false, reason: 'invalid-schedule' });
    expect(protocolFee(1_000n, { ...S, minFee: -1n })).toEqual({ ok: false, reason: 'invalid-schedule' });
    expect(validSchedule({ feeBps: 0n, minFee: 0n, maxFeeShareBps: 0n })).toBe(true);
  });
});

describe('minimumAmount', () => {
  it('is the smallest amount the schedule accepts', () => {
    const m = minimumAmount(S)!;
    expect(m).toBe(10_000n);
    expect(protocolFee(m, S).ok).toBe(true);
    expect(protocolFee(m - 1n, S).ok).toBe(false);
  });
  it('is 1 without a minimum fee, and null when no amount qualifies', () => {
    expect(minimumAmount(NO_MIN)).toBe(1n);
    expect(minimumAmount({ feeBps: 600n, minFee: 0n, maxFeeShareBps: 500n })).toBe(null);
    expect(minimumAmount({ ...S, maxFeeShareBps: 0n })).toBe(null);
  });
});

describe('D-2 placeholder schedule (pending operator confirmation)', () => {
  const P: FeeSchedule = { feeBps: 50n, minFee: 1n, maxFeeShareBps: 1_000n };
  it('matches the vectors in FEE_CONTRACT_SPEC.md section 6', () => {
    expect(minimumAmount(P)).toBe(10n);
    expect(protocolFee(9n, P)).toEqual({ ok: false, reason: 'fee-exceeds-share' });
    expect(protocolFee(10n, P)).toEqual({ ok: true, fee: 1n, net: 9n });
    expect(protocolFee(1_000_000n, P)).toEqual({ ok: true, fee: 5_000n, net: 995_000n });
    expect(protocolFee(10n ** 18n, P)).toEqual({ ok: true, fee: 5n * 10n ** 15n, net: 995n * 10n ** 15n });
  });
});
