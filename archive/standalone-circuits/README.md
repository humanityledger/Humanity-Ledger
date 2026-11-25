# Standalone Noir circuits: retired on 25 November 2026

**Status: retired.** Nothing in the product, the build or the CI compiles, proves or verifies with anything in this folder. It stays here, under git history, so a reviewer can read the code that the findings below describe.

## What was retired

| Path here | Was at | What it was |
|---|---|---|
| `circuits/escrow`, `circuits/identity`, `circuits/streams` | `circuits/` | Standalone Noir circuits v1, with pinned VKs (UltraHonk, BN254) |
| `circuits/escrow_v2`, `circuits/identity_v2`, `circuits/streams_v2`, `circuits/hl_lib` | `circuits/` | v2 circuits (Poseidon2, domain separation), experimental |
| `circuits/CONSTRAINT_COMPLETENESS.md` | `circuits/` | Constraint gaps G1 to G5 of these circuits |
| `lib/zk/prover.ts`, `prover-client.ts`, `browser-prover.ts`, `prover.worker.ts`, `inputs.ts`, `vk-pins.ts` | `lib/zk/` | Node and Web Worker prover for these circuits, and their VK pins |
| `lib/aztec/verifier.ts` | `lib/aztec/` | Off-chain verifier and VK registry reader for these circuits |
| `contracts/ZKVerificationKeyRegistry.sol` | `contracts/` | L1 registry for their VKs. Never deployed |
| `scripts/` | `scripts/`, `scripts/zk/` | Artifact checks, v2 VK derivation, proof benchmark, registry deploy script |
| `test/` | `test/circuits`, `test/zk`, and four other files | Their tests |

## Why

Path A of Aztec is how Ledger Chat moves value: aztec-nr contracts, state as notes, the network's own nullifier tree, private functions, and proofs made on the user's device by the PXE. The standalone circuits were Path B: proofs about numbers, with all state handling left to a verifier, and **no verifier holding state was ever deployed**. They had the known soundness issues below. The v1 circuits were unreachable from the product since 24 November 2026 (guard test, now `test/v1-circuits-unreachable.test.ts` here). On 25 November 2026 they left the product tree.

## Known issues, and where the same concern lives now

Retiring the circuits closes these findings as findings about code the product could reach. **It does not certify the aztec-nr contracts.** Those have their own internal review (`docs/zk/AZTEC_CONTRACTS_REVIEW.md`, AZ-01 to AZ-23) and have no external audit yet; one begins on 25 November 2026.

| ID | Severity | Issue in these circuits | In the aztec-nr contracts (`contracts/aztec/`) |
|---|---|---|---|
| ZK-01 | Critical | Streams: `withdrawn_amount` is a free private input; the same accrual could be claimed many times | `PaymentStream` re-creates the stream note on every withdrawal and emits a state nullifier that the network checks (`docs/AZTEC_FOUNDATION_DOSSIER.md` §2.1) |
| ZK-02 | Critical | Escrow and streams: no payout address among the public inputs, so a proof could be front-run | Value moves as token notes owned by the contract instance and delivered to an address inside a private function, not as a proof anyone can submit |
| ZK-03 | High | Escrow: claiming required the sender's secret; no refund path | `PrivateEscrow` gives the recipient a claim note and the sender a refund note sharing one settlement nullifier |
| ZK-04 | High | Identity: 2-input Pedersen leaf and nullifier with no domain separation | `IdentityCredential`: Poseidon2 membership and one `SingleUseClaim` per scope |
| ZK-05 | High | Identity: depth-1 tree (anonymity set of two); jurisdiction a free witness | `IdentityCredential`: depth-32 tree and committed sanction lists |
| ZK-06 | Medium | Timestamps chosen by the prover | Claim and refund are checked against the anchor block; a cancel expires 600 s after its anchor. Open question 5 of the dossier asks Aztec Labs for a better bound |
| ZK-07 | Medium | Verification did not pin the VK | No standalone verifier remains. The aztec-nr artifacts are pinned by SHA-256 in `lib/aztec/artifact-pins.ts` and published at `/api/security/integrity` |

Status of each aztec-nr contract, from the deployment records: **real on the Aztec test network** (`deployments/aztec-testnet.json`), **refused on Aztec Alpha** until an external audit report is published and approved.

## Reproducing the old results

The last CI run of these circuits is described in `docs/zk/V2_CIRCUITS.md` (3 November 2026, nargo 1.0.0, bb.js 5.3.0). To run them again, copy this folder back to the repository root in a scratch branch: their scripts and tests use paths from the root (`circuits/`, `lib/zk/`). Do not merge that branch.
