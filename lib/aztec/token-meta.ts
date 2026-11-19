/**
 * lib/aztec/token-meta.ts
 *
 * Reads the name, symbol and decimals of a standard Aztec Token instance from public storage,
 * read-only, with the storage slots taken from the artifact itself (never assumed). In the
 * Token of @aztec-labs/noir-contracts.js the three are PublicImmutable values set by the
 * constructor; name and symbol are FieldCompressedString (up to 31 bytes packed big-endian in
 * one field). The read-only preflight uses this to confirm what a deployed HLC is called.
 */
import { storageSlot } from '../protocol/metrics';

export interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
}

/** A FieldCompressedString field back to text: 31 bytes big-endian, NUL padding removed. */
export function decodeCompressedString(field: bigint): string {
  if (field < 0n || field >= 1n << 248n) throw new Error('not a 31-byte compressed string');
  const bytes = new Uint8Array(31);
  let v = field;
  for (let i = 30; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  let a = 0;
  let b = bytes.length;
  while (a < b && bytes[a] === 0) a++;
  while (b > a && bytes[b - 1] === 0) b--;
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(a, b));
}

/** The inverse, for tests: text of at most 31 UTF-8 bytes, right-padded with NUL. */
export function encodeCompressedString(text: string): bigint {
  const raw = new TextEncoder().encode(text);
  if (raw.length > 31) throw new Error('at most 31 bytes');
  const bytes = new Uint8Array(31);
  bytes.set(raw, 0);
  let v = 0n;
  for (const x of bytes) v = (v << 8n) | BigInt(x);
  return v;
}

/** The storage slots of name, symbol and decimals in a Token artifact. */
export function tokenMetaSlots(artifact: unknown): { name: bigint; symbol: bigint; decimals: bigint } {
  const name = storageSlot(artifact, 'Token', 'name');
  const symbol = storageSlot(artifact, 'Token', 'symbol');
  const decimals = storageSlot(artifact, 'Token', 'decimals');
  if (name === undefined || symbol === undefined || decimals === undefined) {
    throw new Error('the Token artifact has no storage slot for name, symbol or decimals');
  }
  return { name, symbol, decimals };
}

/** Reads the metadata with `readField(slot)`, which must read public storage of the instance. */
export async function readTokenMeta(artifact: unknown, readField: (slot: bigint) => Promise<bigint>): Promise<TokenMeta> {
  const slots = tokenMetaSlots(artifact);
  const [name, symbol, decimals] = await Promise.all([readField(slots.name), readField(slots.symbol), readField(slots.decimals)]);
  if (decimals > 255n) throw new Error(`decimals ${decimals} is not a u8`);
  return { name: decodeCompressedString(name), symbol: decodeCompressedString(symbol), decimals: Number(decimals) };
}
