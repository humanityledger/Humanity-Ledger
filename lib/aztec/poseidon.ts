/**
 * lib/aztec/poseidon.ts
 *
 * poseidon2 with a domain separator, imported statically so that the browser
 * bundle can resolve it (a computed import specifier cannot be bundled).
 * Same function the contracts call as poseidon2_hash_with_separator.
 */
import { poseidon2HashWithSeparator } from '@aztec-labs/foundation/crypto/poseidon';
import { Fr } from '@aztec-labs/aztec.js/fields';

export async function poseidon2WithSeparator(inputs: Fr[], separator: number): Promise<Fr> {
  const out: any = await poseidon2HashWithSeparator(inputs as any, separator);
  return out instanceof Fr ? out : new Fr(out.toBigInt ? out.toBigInt() : BigInt(out.toString()));
}
