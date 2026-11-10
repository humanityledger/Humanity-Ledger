/**
 * Short code for reading an Aztec address aloud with the other person.
 * SHA-256 over the canonical address, 64 bits shown: matching the first and
 * last hex digits of an address is cheap to grind, a hash prefix is not.
 * Out-of-band check only; G7 (verifiedPeerBinding) is what gates the payment.
 */
import { canonicalAztecAddress } from './agreement-policy';

export async function addressFingerprint(address: string, subtle: Pick<SubtleCrypto, 'digest'> = globalThis.crypto.subtle): Promise<string> {
  const canon = canonicalAztecAddress(address);
  if (!canon) throw new Error('Not an Aztec address.');
  const digest = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(`hl/aztec-address-fp/v1:${canon}`)));
  const hex = Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.match(/.{4}/g)!.join('-');
}
