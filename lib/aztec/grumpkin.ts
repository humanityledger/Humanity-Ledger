/**
 * lib/aztec/grumpkin.ts — gap G1 (circuits/CONSTRAINT_COMPLETENESS.md).
 *
 * Grumpkin is the curve Aztec uses for account keys and addresses:
 *   y^2 = x^3 - 17  over the BN254 scalar field (p below).
 * An Aztec address is the x-coordinate of an address point, so an address is
 * valid only if x^3 - 17 is a square mod p (some y exists). Funds sent to an
 * address with no point are unrecoverable.
 *
 * This module is dependency-free so it can run before the Aztec SDK loads, on
 * the server, and in tests. The wallet still calls the SDK's own
 * `AztecAddress.isValid()` as well (lib/aztec/wallet/client.ts).
 *
 * The standalone circuits never received a Grumpkin point: v1 took
 * `recipient_pubkey: Field` with no curve check (G1). The v2 circuits replace it
 * with a key hash bound to a secret the recipient must know, so there is no
 * point to validate in-circuit; this file covers the client side.
 */

/** BN254 scalar field = Grumpkin base field. */
export const GRUMPKIN_P = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);

/** Grumpkin coefficient b in y^2 = x^3 + b (b = -17). */
export const GRUMPKIN_B = GRUMPKIN_P - BigInt(17);

/** Grumpkin generator, used as a known point in tests. */
export const GRUMPKIN_GENERATOR = Object.freeze({
  x: BigInt(1),
  y: BigInt('0x0000000000000002cf135e7506a45d632d270d45f1181294833fc48d823f272c'),
});

const mod = (a: bigint): bigint => ((a % GRUMPKIN_P) + GRUMPKIN_P) % GRUMPKIN_P;

function modPow(base: bigint, exp: bigint): bigint {
  let result = BigInt(1);
  let b = mod(base);
  let e = exp;
  while (e > BigInt(0)) {
    if (e & BigInt(1)) result = (result * b) % GRUMPKIN_P;
    b = (b * b) % GRUMPKIN_P;
    e >>= BigInt(1);
  }
  return result;
}

function inField(v: bigint): boolean {
  return v >= BigInt(0) && v < GRUMPKIN_P;
}

/** x^3 - 17 mod p. */
export function curveRhs(x: bigint): bigint {
  return mod(x * x * x + GRUMPKIN_B);
}

/** True when (x, y) satisfies y^2 = x^3 - 17 with both coordinates in the field. */
export function isOnGrumpkin(x: bigint, y: bigint): boolean {
  if (!inField(x) || !inField(y)) return false;
  return mod(y * y) === curveRhs(x);
}

/** True when some y exists for this x (Euler's criterion). */
export function hasGrumpkinPoint(x: bigint): boolean {
  if (!inField(x)) return false;
  const rhs = curveRhs(x);
  if (rhs === BigInt(0)) return true;
  return modPow(rhs, (GRUMPKIN_P - BigInt(1)) / BigInt(2)) === BigInt(1);
}

/**
 * Validates an Aztec address string: 0x + 64 hex characters, inside the field,
 * and the x-coordinate of a Grumpkin point.
 */
export function isValidAztecAddress(value: string): boolean {
  const text = value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(text)) return false;
  return hasGrumpkinPoint(BigInt(text));
}
