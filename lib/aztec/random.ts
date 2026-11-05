/**
 * lib/aztec/random.ts
 *
 * Fresh field elements for the secrets of an agreement: contract secret key,
 * deployment salt, escrow claim secret, escrow id, stream salt, authwit nonce.
 *
 * 64 bytes from the platform CSPRNG (Web Crypto, in the browser and in Node)
 * reduced modulo the BN254 scalar field. With 512 input bits the distance
 * from uniform is below 2^-258; reducing only 32 bytes, as a plain random
 * reduction does, leaves a measurable bias because 2^256 is about 5.3 times
 * the modulus.
 */
import { Fr } from '@aztec-labs/aztec.js/fields';

const FIELD_MODULUS = Fr.MODULUS;

export function randomField(): Fr {
  const bytes = new Uint8Array(64);
  globalThis.crypto.getRandomValues(bytes);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return new Fr(n % FIELD_MODULUS);
}
