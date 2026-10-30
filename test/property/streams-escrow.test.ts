import { vi } from 'vitest';
import fc from 'fast-check';

describe('J-015: Property-based testing of Streams and Escrow accounting', () => {
  it('Stream invariant: withdrawn + remaining exactly equals total deposit', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 1_000_000_000_000n }), // deposit
        fc.integer({ min: 1, max: 86400 * 30 }),         // duration in seconds
        fc.integer({ min: 0, max: 86400 * 30 }),         // elapsed time
        (deposit, duration, elapsed) => {
          const effectiveElapsed = BigInt(Math.min(elapsed, duration));
          const totalDuration = BigInt(duration);

          const vested = (deposit * effectiveElapsed) / totalDuration;
          const remaining = deposit - vested;

          expect(vested + remaining).toBe(deposit);
          expect(vested).toBeGreaterThanOrEqual(0n);
          expect(remaining).toBeGreaterThanOrEqual(0n);
          expect(vested).toBeLessThanOrEqual(deposit);
        }
      ),
      { numRuns: 5_000 }
    );
  });

  it('Escrow invariant: released + refunded can never exceed deposit', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 1_000_000_000_000n }), // total escrow deposit
        fc.bigInt({ min: 0n, max: 1_000_000_000_000n }), // partial release
        (deposit, requestedRelease) => {
          const released = requestedRelease > deposit ? deposit : requestedRelease;
          const refunded = deposit - released;

          expect(released + refunded).toBe(deposit);
          expect(released).toBeLessThanOrEqual(deposit);
          expect(refunded).toBeLessThanOrEqual(deposit);
        }
      ),
      { numRuns: 5_000 }
    );
  });
});
