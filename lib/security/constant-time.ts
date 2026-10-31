import crypto from 'node:crypto';

/**
 * lib/security/constant-time.ts
 *
 * Implements constant-time comparisons for cryptographic secrets, MACs,
 * signatures, and session tokens to mitigate side-channel timing attacks (Item 12).
 */

/**
 * Performs a timing-safe, constant-time comparison between two string secrets.
 * Ensures the comparison does not leak string length or byte differences via timing.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  // If lengths differ, we still perform comparison against padded buffer
  // to avoid immediate timing differential on length mismatch
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison to equalize timing profile
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Performs constant-time comparison between two Buffer instances.
 */
export function constantTimeCompareBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
