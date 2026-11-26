/**
 * G8 reference hashing (docs/protocol/G8_ZKPSP_SPEC.md §3). Byte-for-byte the
 * same functions as circuits/g8_admission/src/main.nr: poseidon2 with the G8
 * domain separators over BN254 F_r, and SHA-256 for the context binding and
 * block fingerprints. Pure: the poseidon2 implementation is injected (the app
 * uses aztec-labs/foundation; tests pass the same function).
 */
import { DOM_SEP, FR_MODULUS, G8_BLOCK_TAG, G8_VERSION, TREE_DEPTH } from '@/lib/g8/constants';

export type Poseidon2 = (inputs: bigint[], separator: number) => Promise<bigint>;

let defaultP2: Poseidon2 | null = null;
/** aztec-nr's poseidon2_hash_with_separator, loaded on first use. */
export async function foundationPoseidon2(): Promise<Poseidon2> {
  if (defaultP2) return defaultP2;
  const [{ poseidon2HashWithSeparator }, { Fr }] = await Promise.all([
    import('@aztec-labs/foundation/crypto/poseidon'),
    import('@aztec-labs/aztec.js/fields'),
  ]);
  defaultP2 = async (inputs, sep) => {
    const out = await poseidon2HashWithSeparator(inputs.map(x => new Fr(x)) as never, sep);
    return BigInt((out as { toString(): string }).toString());
  };
  return defaultP2;
}

const enc = new TextEncoder();
export const toField = (x: bigint) => ((x % FR_MODULUS) + FR_MODULUS) % FR_MODULUS;
export const hex32 = (x: bigint) => '0x' + x.toString(16).padStart(64, '0');

async function sha256(parts: Array<string | Uint8Array>): Promise<Uint8Array> {
  const chunks = parts.map(p => (typeof p === 'string' ? enc.encode(p) : p));
  const buf = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}
const bytesToBig = (b: Uint8Array) => BigInt('0x' + [...b].map(x => x.toString(16).padStart(2, '0')).join(''));

export interface Leaf { jurisdiction: number; tExp: number; attrs: number; salt: bigint }

export const humanId = (p2: Poseidon2, sHuman: bigint) => p2([sHuman], DOM_SEP.HUMAN_ID);

export async function leafHash(p2: Poseidon2, sHuman: bigint, l: Leaf): Promise<bigint> {
  return p2([await humanId(p2, sHuman), BigInt(l.jurisdiction), BigInt(l.tExp), BigInt(l.attrs), l.salt], DOM_SEP.LEAF);
}

export async function merkleRoot(p2: Poseidon2, leaf: bigint, index: number, siblings: bigint[]): Promise<bigint> {
  if (siblings.length !== TREE_DEPTH) throw new Error(`G8: ${TREE_DEPTH} siblings required`);
  let cur = leaf; let idx = index >>> 0;
  for (let i = 0; i < TREE_DEPTH; i++) {
    const right = (idx & 1) === 1; idx >>>= 1;
    cur = await p2(right ? [siblings[i], cur] : [cur, siblings[i]], DOM_SEP.NODE);
  }
  return cur;
}

/** scope_B = P2_SCOPE([domainTag, targetHash, r_B]); targetHash = SHA-256(B) mod r. */
export async function scopeId(p2: Poseidon2, target: string, rB = 0n): Promise<bigint> {
  const domainTag = toField(bytesToBig(await sha256([G8_VERSION])));
  const targetHash = toField(bytesToBig(await sha256([target.toLowerCase()])));
  return p2([domainTag, targetHash, rB], DOM_SEP.SCOPE);
}

/** T(A→B) = P2_NULLIFIER([s_human, scope_B]) — one per human per scope. */
export const scopedTag = (p2: Poseidon2, sHuman: bigint, scope: bigint) => p2([sHuman, scope], DOM_SEP.NULLIFIER);

export async function sanctionRoot(p2: Poseidon2, list: number[]): Promise<bigint> {
  const slots = [...list.map(BigInt), ...Array(Math.max(0, 16 - list.length)).fill(0n)].slice(0, 16);
  return p2(slots, DOM_SEP.SANCTIONS);
}

export interface ContextInput { wallet: string; inbox: string; nonce: string; tNow: number }
/** c = SHA-256("hl/zksp/v1 | " ‖ wallet ‖ "|" ‖ inbox ‖ "|" ‖ nonce ‖ "|" ‖ t) mod r. */
export async function contextBinding(c: ContextInput): Promise<bigint> {
  return toField(bytesToBig(await sha256([`${G8_VERSION} | ${c.wallet.toLowerCase()}|${c.inbox.toLowerCase()}|${c.nonce}|${c.tNow}`])));
}

/** h_block = SHA-256("hl/zkblock/v1" ‖ B ‖ T) as hex — the only thing ever stored for a block. */
export async function blockFingerprint(owner: string, tag: bigint): Promise<string> {
  const h = await sha256([G8_BLOCK_TAG, owner.toLowerCase(), hex32(tag)]);
  return [...h].map(x => x.toString(16).padStart(2, '0')).join('');
}
