import { describe, it, expect } from 'vitest';
import {
  BASELINE_ESCROW_SCHEDULE,
  BASELINE_STREAM_SCHEDULE,
  BASELINE_TX_CAP,
  BPS,
  TREASURY_ADDRESS_SET,
  U128_MAX,
  baselineFee,
  ceilBps,
  minimumAmount,
  protocolFee,
  validSchedule,
  type FeeSchedule,
} from '@/lib/protocol/fees';
import { agreementFee } from '@/lib/protocol/tokenomics';

// Section 1 fixture. Not the authorized baseline.
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

describe('section 1 test vectors', () => {
  const rows: Array<[bigint, bigint, bigint] | [bigint, 'refused']> = [
    [1n, 'refused'],
    [9_999n, 'refused'],
    [10_000n, 500n, 9_500n],
    [10_001n, 500n, 9_501n],
    [166_667n, 501n, 166_166n],
    [166_668n, 501n, 166_167n],
    [1_000_000n, 3_000n, 997_000n],
    [1_234_567n, 3_704n, 1_230_863n],
    [100_000_000_000n, 300_000_000n, 99_700_000_000n],
    [U128_MAX, 1_020_847_100_762_815_390_390_123_822_295_304_635n, 339_261_519_820_175_648_072_984_483_609_472_906_820n],
  ];
  it('reproduces every row, and the u128-safe share check matches the direct comparison', () => {
    const shareOk = (amount: bigint, fee: bigint, share: bigint) => {
      if (fee > amount) return false;
      const q = amount / BPS;
      const r = amount % BPS;
      const qShare = q * share;
      if (fee <= qShare) return true;
      const t = fee - qShare;
      if (t > share) return false;
      return t * BPS <= r * share;
    };
    for (const row of rows) {
      const q = protocolFee(row[0], S);
      if (row[1] === 'refused') {
        expect(q).toEqual({ ok: false, reason: 'fee-exceeds-share' });
      } else if (q.ok) {
        expect(q.fee).toBe(row[1]);
        expect(q.net).toBe(row[2]);
        expect(shareOk(row[0], q.fee, S.maxFeeShareBps)).toBe(q.fee * BPS <= row[0] * S.maxFeeShareBps);
      } else {
        throw new Error(`expected a fee for ${row[0]}`);
      }
    }
    for (const a of amounts(400)) {
      const q = protocolFee(a, S);
      if (q.ok) expect(shareOk(a, q.fee, S.maxFeeShareBps)).toBe(true);
    }
  });
});

describe('D-2 placeholder schedule (printed minFee 1, not the compile minimum)', () => {
  const P: FeeSchedule = { feeBps: 50n, minFee: 1n, maxFeeShareBps: 1_000n };
  it('matches the vectors in FEE_CONTRACT_SPEC.md section 6', () => {
    expect(minimumAmount(P)).toBe(10n);
    expect(protocolFee(9n, P)).toEqual({ ok: false, reason: 'fee-exceeds-share' });
    expect(protocolFee(10n, P)).toEqual({ ok: true, fee: 1n, net: 9n });
    expect(protocolFee(1_000_000n, P)).toEqual({ ok: true, fee: 5_000n, net: 995_000n });
    expect(protocolFee(10n ** 18n, P)).toEqual({ ok: true, fee: 5n * 10n ** 15n, net: 995n * 10n ** 15n });
  });
});

describe('authorized baseline (16 November 2026)', () => {
  it('charges the escrow minimum on settlement amounts and refuses the share and the cap', () => {
    // Designated 17 November 2026 (not the 4-of-7). Deploy is still gated: lib/protocol/agreement-gate.ts.
    expect(TREASURY_ADDRESS_SET).toBe(true);
    expect(minimumAmount(BASELINE_ESCROW_SCHEDULE)).toBe(10_000n);
    expect(baselineFee(10_000n, BASELINE_ESCROW_SCHEDULE)).toEqual({ ok: true, fee: 1_000n, net: 9_000n });
    expect(baselineFee(9_999n, BASELINE_ESCROW_SCHEDULE)).toEqual({ ok: false, reason: 'fee-exceeds-share' });
    expect(baselineFee(20_000n, BASELINE_ESCROW_SCHEDULE)).toEqual({ ok: true, fee: 1_000n, net: 19_000n });
    expect(baselineFee(1_000_000_000n, BASELINE_ESCROW_SCHEDULE)).toEqual({
      ok: true,
      fee: BASELINE_TX_CAP,
      net: 995_000_000n,
    });
    expect(baselineFee(1_000_000_001n, BASELINE_ESCROW_SCHEDULE)).toEqual({ ok: false, reason: 'fee-exceeds-tx-cap' });
  });
  it('uses a zero minimum on streams and still refuses a fee above 10% or the cap', () => {
    expect(minimumAmount(BASELINE_STREAM_SCHEDULE)).toBe(10n);
    expect(baselineFee(10n, BASELINE_STREAM_SCHEDULE)).toEqual({ ok: true, fee: 1n, net: 9n });
    expect(baselineFee(9n, BASELINE_STREAM_SCHEDULE)).toEqual({ ok: false, reason: 'fee-exceeds-share' });
    expect(baselineFee(5n, BASELINE_STREAM_SCHEDULE)).toEqual({ ok: false, reason: 'fee-exceeds-share' });
    expect(baselineFee(100n, BASELINE_STREAM_SCHEDULE)).toEqual({ ok: true, fee: 1n, net: 99n });
    expect(baselineFee(200_000n, BASELINE_STREAM_SCHEDULE)).toEqual({ ok: true, fee: 1_000n, net: 199_000n });
  });
});
