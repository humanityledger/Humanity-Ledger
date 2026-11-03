# Humanity Ledger — VK pinning and monitoring

**Version 2.0 — 3 November 2026.** Replaces version 1.0 (31 October 2026), which described an on-chain VK registry behind a 14-day timelock in `HumanityTimeLockVault`, a 60-second alert path and client-side lifecycle enforcement against that registry. None of that exists: `HumanityTimeLockVault` is a dead-man switch vault and stores no VKs, and no registry contract is deployed.

## 1. What exists today

| Mechanism | Where | What it guarantees |
|---|---|---|
| Pinned VK hashes in code | `lib/aztec/verifier.ts` (`PINNED_VK_SHA256`) | The binary VK on disk (`circuits/<c>/target/vk`) is the one reviewed |
| Metadata with the same hash | `circuits/<c>/target/<c>.vk.json` (`vkSha256`) | The description matches the key |
| Re-derivation from ACIR | `scripts/zk/check-artifacts.mjs` (bb.js 5.3.0) | The VK is what Barretenberg derives from the committed bytecode |
| Committed ACIR equals source | CI workflow "Noir circuits" | The bytecode is what nargo 1.0.0 compiles from `src/main.nr` |
| Pinned verifier | `lib/zk/prover.ts` (`verifyProof`) | A swapped artifact makes verification return false |
| Lifecycle check against a caller-supplied registry | `assertVKIntegrity` in `lib/aztec/verifier.ts` | ACTIVE / DEPRECATED (warns) / RETIRED (blocks). No registry is read from a chain |

## 2. Pinned hashes (v1 circuits)

| Circuit | VK SHA-256 |
|---|---|
| escrow | `0x4e3cc4c8ce03607dcb2b98bd50c0d31084300634ee8f70f4674919682eb915c2` |
| identity | `0xcd02d2407de202d61e1a03c360633a9b0cdd8fe4b4d67b007cce108990632194` |
| streams | `0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346` |

The v2 circuits (`circuits/*_v2`) are not pinned. CI derives their VKs and prints the hashes (`scripts/zk/v2-vks.mjs`).

## 3. Changing a circuit

1. Edit `src/main.nr` and run `nargo test`.
2. `nargo compile`, then derive the new VK with bb.js (`scripts/zk/v2-vks.mjs` shows how) and write `target/vk`.
3. Update `PINNED_VK_SHA256`, `vkSha256`, `vkBytes` and `vkHeader` in the same commit.
4. `node scripts/zk/check-artifacts.mjs` must pass; CI runs it.

## 4. What an on-chain registry would need (not built)

A registry contract that stores `(circuit, vkSha256, status)` behind a delay, events on queue and execution, and a client that reads it before proving. Until it exists, documentation must not refer to "anchored" or "registered" VKs.
