/**
 * The issuer's credential tree produces the root and paths that
 * IdentityCredential.verify_and_claim accepts: rootFromPath mirrors the
 * contract's loop, and a single leaf at index 0 with all-zero siblings gives
 * the same root the testnet e2e published.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  CredentialTree,
  rootFromPath,
  credentialLeaf,
  identityCommitment,
  aztecPoseidon2,
  DEPTH,
  DOM_SEP__MERKLE_NODE,
  type Hash,
} from '@/lib/aztec/credential-tree';

// Cheap deterministic stand-in for structure tests (not a cryptographic hash).
const P = (1n << 61n) - 1n;
const fake: Hash = async (inputs, sep) => {
  let acc = BigInt(sep) + 0x9e3779b97f4a7c15n;
  for (const x of inputs) acc = ((acc ^ x) * 0x100000001b3n + 7n) % P;
  return acc === 0n ? 1n : acc;
};

describe('CredentialTree (structure)', () => {
  it('gives every member a path to the published root', async () => {
    const leaves = new Map<number, bigint>([
      [0, 11n],
      [1, 12n],
      [5, 13n],
      [2 ** 31, 14n],
      [2 ** 32 - 1, 15n],
    ]);
    const tree = await CredentialTree.build(fake, leaves);
    for (const [i, leaf] of leaves) {
      const p = tree.path(i);
      expect(p.siblings).toHaveLength(DEPTH);
      expect(await rootFromPath(fake, leaf, p)).toBe(tree.root);
    }
  });

  it('rejects a wrong leaf, a wrong index and a tampered sibling', async () => {
    const tree = await CredentialTree.build(fake, new Map([[3, 21n], [4, 22n]]));
    const p = tree.path(3);
    expect(await rootFromPath(fake, 22n, p)).not.toBe(tree.root);
    expect(await rootFromPath(fake, 21n, { ...p, leafIndex: 2 })).not.toBe(tree.root);
    const s = [...p.siblings];
    s[0] = s[0] + 1n;
    expect(await rootFromPath(fake, 21n, { ...p, siblings: s })).not.toBe(tree.root);
  });

  it('refuses zero leaves, out-of-range indices and missing members', async () => {
    await expect(CredentialTree.build(fake, new Map([[0, 0n]]))).rejects.toThrow();
    await expect(CredentialTree.build(fake, new Map([[2 ** 32, 1n]]))).rejects.toThrow();
    await expect(CredentialTree.build(fake, new Map([[-1, 1n]]))).rejects.toThrow();
    const tree = await CredentialTree.build(fake, new Map([[0, 1n]]));
    expect(() => tree.path(1)).toThrow();
  });
});

describe('CredentialTree (Aztec poseidon2)', () => {
  let h: Hash;
  beforeAll(async () => {
    h = await aztecPoseidon2();
  });

  it('matches the single-leaf root of the testnet e2e (leaf at index 0, zero siblings)', async () => {
    const commitment = await identityCommitment(h, 0x1234n, 0x5678n);
    const leaf = await credentialLeaf(h, { commitment, jurisdiction: 724, expiry: 1_900_000_000n, salt: 0x9an });
    let expected = leaf;
    for (let i = 0; i < DEPTH; i++) expected = await h([expected, 0n], DOM_SEP__MERKLE_NODE);
    const tree = await CredentialTree.build(h, new Map([[0, leaf]]));
    expect(tree.root).toBe(expected);
    expect(tree.path(0).siblings.every((s) => s === 0n)).toBe(true);
  });

  it('builds paths that verify for several members', async () => {
    const leaves = new Map<number, bigint>();
    for (const [i, member] of [[0, 1n], [1, 2n], [6, 3n]] as const) {
      const commitment = await identityCommitment(h, member, 100n + member);
      leaves.set(i, await credentialLeaf(h, { commitment, jurisdiction: 724, expiry: 1_900_000_000n, salt: member }));
    }
    const tree = await CredentialTree.build(h, leaves);
    for (const [i, leaf] of leaves) expect(await rootFromPath(h, leaf, tree.path(i))).toBe(tree.root);
  });
});
