/**
 * PROPERTY-BASED TESTING  Z-Score Analytics Engine
 *
 * Uses fast-check to generate thousands of random inputs and verify
 * that the Z-Score engine maintains mathematical invariants under all conditions.
 *
 * Invariants tested:
 *   1. Z-Score  [-10, 10] for any valid numeric input
 *   2. Monotonicity: higher volume  higher Z-Score (ceteris paribus)
 *   3. Symmetry: negative deviation returns negative Z-Score
 *   4. Identity: input = mean  Z-Score = 0
 *   5. Normalization: scaled inputs produce identical Z-Score
 *   6. No NaN/Infinity for any finite numeric input
 *   7. Division-by-zero safe when std_dev = 0
 */

import { vi } from 'vitest';
import * as fc from 'fast-check';

//  Z-Score Engine (extracted for testability) 
// This is the core formula used in entity-graph-miner and ledger-worker
// to classify ledger activity conviction level.

function computeZScore(value: number, mean: number, stdDev: number): number {
  if (!isFinite(value) || !isFinite(mean) || !isFinite(stdDev)) return 0;
  if (stdDev === 0) return 0; // Division-by-zero guard
  const z = (value - mean) / stdDev;
  // Clamp to [-10, 10]  extreme outliers are treated as maximum conviction
  return Math.max(-10, Math.min(10, z));
}

function computeConvictionTier(zScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  const abs = Math.abs(zScore);
  if (abs < 1.0) return 'LOW';
  if (abs < 2.0) return 'MEDIUM';
  if (abs < 3.0) return 'HIGH';
  return 'EXTREME';
}

function computeLedgerZScore(params: {
  volumeUSD: number;
  historicalMeanUSD: number;
  historicalStdDevUSD: number;
  velocityFactor: number; // 0-1: how fast the transaction moved
  institutionalFlag: boolean;
}): number {
  const baseZ = computeZScore(params.volumeUSD, params.historicalMeanUSD, params.historicalStdDevUSD);
  const velocityBonus = params.velocityFactor * 0.5; // max 0.5 additional Z
  const institutionalBonus = params.institutionalFlag ? 1.0 : 0;
  return Math.max(-10, Math.min(10, baseZ + velocityBonus + institutionalBonus));
}

//  Property-Based Tests 

describe('Z-Score Engine  Property-Based Tests (fast-check)', () => {

  // PROPERTY 1: Output always in [-10, 10] for any finite input
  it('P1: Z-Score always bounded in [-10, 10]', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e12, max: 1e12 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e12, max: 1e12 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1e12 }),
        (value, mean, stdDev) => {
          const z = computeZScore(value, mean, stdDev);
          return z >= -10 && z <= 10;
        }
      ),
      { numRuns: 10_000 }
    );
  });

  // PROPERTY 2: Z-Score is never NaN or Infinity
  it('P2: Z-Score never produces NaN or Infinity', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e15, max: 1e15 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e15, max: 1e15 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1e15 }),
        (value, mean, stdDev) => {
          const z = computeZScore(value, mean, stdDev);
          return isFinite(z) && !isNaN(z);
        }
      ),
      { numRuns: 10_000 }
    );
  });

  // PROPERTY 3: Identity  value equals mean  Z-Score = 0
  it('P3: Z-Score = 0 when value equals mean (for any stdDev > 0)', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1e10 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0.001, max: 1e8 }),
        (mean, stdDev) => {
          const z = computeZScore(mean, mean, stdDev);
          return Math.abs(z) < 1e-9; // floating point tolerance
        }
      ),
      { numRuns: 5_000 }
    );
  });

  // PROPERTY 4: Monotonicity  higher value  higher Z-Score (same mean/stdDev)
  it('P4: Monotonicity  larger value produces larger Z-Score', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1e9 }),
          fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1e9 })
        ).filter(([a, b]) => a !== b),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1e8 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0.001, max: 1e6 }),
        ([v1, v2], mean, stdDev) => {
          const z1 = computeZScore(v1, mean, stdDev);
          const z2 = computeZScore(v2, mean, stdDev);
          // If v1 > v2, then z1 >= z2 (monotonically non-decreasing)
          if (v1 > v2) return z1 >= z2;
          return z2 >= z1;
        }
      ),
      { numRuns: 5_000 }
    );
  });

  // PROPERTY 5: Symmetry  deviation above mean = positive Z, below = negative Z
  it('P5: Symmetry  Z(mean + Δ) = -Z(mean - Δ)', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 1e3, max: 1e9 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 1e2, max: 1e7 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 1e2, max: 1e7 }),
        (mean, delta, stdDev) => {
          const zAbove = computeZScore(mean + delta, mean, stdDev);
          const zBelow = computeZScore(mean - delta, mean, stdDev);
          return Math.abs(zAbove + zBelow) < 1e-9; // symmetric around 0
        }
      ),
      { numRuns: 5_000 }
    );
  });

  // PROPERTY 6: Division by zero  returns 0 (no exception)
  it('P6: stdDev = 0  Z-Score = 0 for any value', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e12, max: 1e12 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e12, max: 1e12 }),
        (value, mean) => {
          const z = computeZScore(value, mean, 0);
          return z === 0;
        }
      ),
      { numRuns: 5_000 }
    );
  });

  // PROPERTY 7: Conviction tier is always a valid enum value
  it('P7: computeConvictionTier always returns a valid tier', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -10, max: 10 }),
        (z) => {
          const tier = computeConvictionTier(z);
          return ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'].includes(tier);
        }
      ),
      { numRuns: 10_000 }
    );
  });

  // PROPERTY 8: Ledger Z-Score with sovereign flag always >= base Z-Score
  it('P8: Sovereign flag always increases or maintains Z-Score', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1e9 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1e8 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 1, max: 1e7 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1 }),
        (volume, mean, stdDev, velocity) => {
          const base = computeLedgerZScore({ volumeUSD: volume, historicalMeanUSD: mean, historicalStdDevUSD: stdDev, velocityFactor: velocity, institutionalFlag: false });
          const sovereign = computeLedgerZScore({ volumeUSD: volume, historicalMeanUSD: mean, historicalStdDevUSD: stdDev, velocityFactor: velocity, institutionalFlag: true });
          // Sovereign Z should be >= base (clamped at 10)
          return sovereign >= base || (base >= 10 && sovereign >= 10);
        }
      ),
      { numRuns: 5_000 }
    );
  });

  // PROPERTY 9: Scale invariance  scaling all values by same constant preserves Z-Score
  it('P9: Scale invariance  Z(kv, km, kσ) = Z(v, m, σ)', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 1, max: 1e6 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1e5 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 1, max: 1e4 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0.01, max: 100 }),
        (value, mean, stdDev, k) => {
          const z1 = computeZScore(value, mean, stdDev);
          const z2 = computeZScore(value * k, mean * k, stdDev * k);
          return Math.abs(z1 - z2) < 1e-6;
        }
      ),
      { numRuns: 5_000 }
    );
  });
});
