/**
 * lib/zk/vk-pins.ts
 *
 * Pinned SHA-256 of each binary verification key (`circuits/<c>/target/vk`),
 * produced by @aztec/bb.js 5.3.0 from the ACIR compiled by nargo 1.0.0.
 * Browser-safe (no Node imports): used by lib/aztec/verifier.ts on the server
 * and by lib/zk/browser-prover.ts in the Web Worker. Changing a circuit means
 * recompiling, regenerating the VK (scripts/zk/check-artifacts.mjs --write)
 * and updating these constants in the same commit.
 */

export type CircuitName = 'escrow' | 'identity' | 'streams';

export const PINNED_VK_SHA256: Readonly<Record<CircuitName, string>> = Object.freeze({
  escrow: '0x4e3cc4c8ce03607dcb2b98bd50c0d31084300634ee8f70f4674919682eb915c2',
  identity: '0xcd02d2407de202d61e1a03c360633a9b0cdd8fe4b4d67b007cce108990632194',
  streams: '0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346',
});

export const CIRCUITS: readonly CircuitName[] = Object.freeze(['escrow', 'identity', 'streams']);
