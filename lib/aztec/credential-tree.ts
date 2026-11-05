/**
 * lib/aztec/credential-tree.ts
 *
 * The issuer side of IdentityCredential (contracts/aztec/identity): the
 * depth-32 Merkle tree of credential leaves whose root the issuer publishes
 * with update_root, and the path each member passes to verify_and_claim.
 *
 * Same hashes as the contract (poseidon2 with separators):
 *   commitment = H([member, secret],                    DOM_SEP__IDENTITY_COMMITMENT)
 *   leaf       = H([commitment, jurisdiction, expiry, salt], DOM_SEP__IDENTITY_LEAF)
 *   node       = H([left, right],                       DOM_SEP__MERKLE_NODE)
 * An empty subtree is 0 at every level, so a tree with one leaf at index 0
 * has all-zero siblings. The contract walks the path from the leaf: bit i of
 * the leaf index says whether the node at level i is a right child.
 *
 * The issuer never needs the member's secret: the member hands over its
 * commitment and keeps the secret, which only the claim uses. The salt is
 * chosen by the issuer and given to the member with the path.
 *
 * Sparse: storing n leaves costs about 32·n hashes, whatever the indices.
 */

export const DEPTH = 32;
export const DOM_SEP__IDENTITY_COMMITMENT = 120938471;
export const DOM_SEP__IDENTITY_LEAF = 238471092;
export const DOM_SEP__MERKLE_NODE = 349582103;

/** poseidon2 with a domain separator, over field elements as bigints. */
export type Hash = (inputs: bigint[], separator: number) => Promise<bigint>;

/** The hash Aztec uses, from @aztec-labs/foundation (loaded on first use). */
export async function aztecPoseidon2(): Promise<Hash> {
  const { Fr } = await import('@aztec-labs/aztec.js/fields');
  let fn: ((inputs: unknown[], sep: number) => Promise<{ toBigInt(): bigint }>) | undefined;
  for (const m of ['@aztec-labs/foundation/crypto/poseidon', '@aztec-labs/foundation/crypto']) {
    try {
      const mod: any = await import(/* @vite-ignore */ m);
      if (mod.poseidon2HashWithSeparator) {
        fn = mod.poseidon2HashWithSeparator;
        break;
      }
    } catch {
      /* next export path */
    }
  }
  if (!fn) throw new Error('poseidon2HashWithSeparator not found in @aztec-labs/foundation');
  const f = fn;
  return async (inputs, sep) => (await f(inputs.map((x) => new Fr(x)), sep)).toBigInt();
}

const MAX_INDEX = 2 ** DEPTH - 1;

export interface CredentialTerms {
  /** H([member, secret]) as the member computed it. */
  commitment: bigint;
  /** ISO 3166-1 numeric country code. */
  jurisdiction: number;
  /** Unix seconds. */
  expiry: bigint;
  salt: bigint;
}

export const identityCommitment = (h: Hash, member: bigint, secret: bigint) =>
  h([member, secret], DOM_SEP__IDENTITY_COMMITMENT);

export const credentialLeaf = (h: Hash, t: CredentialTerms) =>
  h([t.commitment, BigInt(t.jurisdiction), t.expiry, t.salt], DOM_SEP__IDENTITY_LEAF);

export interface MembershipPath {
  leafIndex: number;
  siblings: bigint[];
}

export class CredentialTree {
  /** levels[0] holds the leaves, levels[DEPTH] the root; absent nodes are 0. */
  private levels: Map<number, bigint>[] = Array.from({ length: DEPTH + 1 }, () => new Map());

  private constructor(private readonly h: Hash) {}

  /** Builds the tree from leaves by index. Indices must be distinct and below 2^32. */
  static async build(h: Hash, leaves: ReadonlyMap<number, bigint>): Promise<CredentialTree> {
    const t = new CredentialTree(h);
    for (const [i, leaf] of leaves) {
      if (!Number.isInteger(i) || i < 0 || i > MAX_INDEX) throw new Error(`leaf index out of range: ${i}`);
      if (leaf === 0n) throw new Error(`leaf ${i} is zero, which marks an empty slot`);
      t.levels[0].set(i, leaf);
    }
    for (let level = 0; level < DEPTH; level++) {
      const parents = new Set<number>();
      for (const i of t.levels[level].keys()) parents.add(Math.floor(i / 2));
      for (const p of parents) {
        const left = t.node(level, 2 * p);
        const right = t.node(level, 2 * p + 1);
        t.levels[level + 1].set(p, await h([left, right], DOM_SEP__MERKLE_NODE));
      }
    }
    return t;
  }

  private node(level: number, index: number): bigint {
    return this.levels[level].get(index) ?? 0n;
  }

  /** The root to publish with update_root (0 for an empty tree). */
  get root(): bigint {
    return this.node(DEPTH, 0);
  }

  /** The path a member passes to verify_and_claim as (leaf_index, siblings). */
  path(leafIndex: number): MembershipPath {
    if (!this.levels[0].has(leafIndex)) throw new Error(`no leaf at index ${leafIndex}`);
    const siblings: bigint[] = [];
    let idx = leafIndex;
    for (let level = 0; level < DEPTH; level++) {
      siblings.push(this.node(level, idx % 2 === 0 ? idx + 1 : idx - 1));
      idx = Math.floor(idx / 2);
    }
    return { leafIndex, siblings };
  }
}

/** The contract's membership check, step for step (verify_and_claim, step 5). */
export async function rootFromPath(h: Hash, leaf: bigint, p: MembershipPath): Promise<bigint> {
  if (p.siblings.length !== DEPTH) throw new Error(`expected ${DEPTH} siblings`);
  let current = leaf;
  let idx = p.leafIndex;
  for (let i = 0; i < DEPTH; i++) {
    const isRight = idx % 2 === 1;
    idx = Math.floor(idx / 2);
    current = isRight ? await h([p.siblings[i], current], DOM_SEP__MERKLE_NODE) : await h([current, p.siblings[i]], DOM_SEP__MERKLE_NODE);
  }
  return current;
}
