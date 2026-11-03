# Humanity Ledger Protocol

A messaging application (Ledger Chat) that uses XMTP for end-to-end encrypted direct messages and the Aztec network (testnet) for private payments, plus experimental standalone Noir circuits.

```
Proving (wallet):       Aztec PXE in the browser, Token and SponsoredFPC contracts (Aztec testnet)
Proving (circuits):     UltraHonk over BN254 with Barretenberg (@aztec/bb.js 5.3.0), experimental, tests only
Direct messages:        XMTP v3 (MLS, RFC 9420, implemented by XMTP through OpenMLS)
Community posts:        Stored by the application server, readable by it (see below)
L1 contracts:           Solidity, Cancun EVM, not audited, not deployed to mainnet
Release stage:          Pre-release · Aztec testnet only · no external audit
Engineering plan:       docs/zk/MASTER_PROMPT.md
Aztec review dossier:   docs/AZTEC_FOUNDATION_DOSSIER.md
```

The state of every component, in one vocabulary (real on testnet, real in tests only, local demo, simulated, retired), is the table "Estado real por componente" in [`docs/zk/MASTER_PROMPT.md`](docs/zk/MASTER_PROMPT.md). This README does not claim more than that table.

---

## 1. Architecture

1. **Private payments (real on testnet).** `lib/aztec/wallet/` runs an Aztec PXE in the browser with a Schnorr account whose keys are derived from a signature by the user's EVM wallet. It shields, sends privately and unshields with the standard `Token` contract, paying fees through `SponsoredFPC`.
2. **Direct messages (real, provided by XMTP).** One-to-one messages travel over XMTP v3, which uses MLS (RFC 9420). Humanity Ledger does not implement MLS itself.
3. **Communities (server-readable).** Community posts and community channel messages are stored in PostgreSQL by the application server and are readable by it. The interface says so. Moving communities to XMTP MLS groups is planned in [`docs/communities/MLS_MIGRATION.md`](docs/communities/MLS_MIGRATION.md) (task R-17).
4. **Standalone Noir circuits (experimental).** `circuits/escrow`, `circuits/identity` and `circuits/streams` compile with nargo 1.0.0 and prove with Barretenberg in tests. They are not used by the app and have known soundness issues (section 5).

```
+----------------------------------------------------------------------+
|                 Client (browser / desktop)                           |
|                                                                      |
|  +-------------------------+        +-----------------------------+  |
|  | XMTP v3 client          |        | Aztec PXE (lib/aztec/wallet)|  |
|  | direct messages (MLS)   |        | Token + SponsoredFPC        |  |
|  +-------------------------+        +--------------+--------------+  |
+--------------------------------------------------- | ----------------+
                                                     | private tx
                                                     v
                                     +-------------------------------+
                                     | Aztec testnet                 |
                                     +-------------------------------+

  Not connected to the above:
  circuits/  (escrow, identity, streams)  ->  lib/zk/prover.ts  ->  tests only
```

---

## 2. Repository layout

| Directory | What it holds |
|---|---|
| `circuits/` | Experimental standalone Noir circuits: v1 (`escrow`, `identity`, `streams`, pinned VKs) and v2 (`*_v2`, shared `hl_lib`, not pinned) |
| `contracts/` | Solidity contracts (Cancun EVM). Not audited |
| `lib/aztec/` | Aztec wallet (PXE, keys, tokens) and the VK pinning checks (`verifier.ts`) |
| `lib/zk/` | `prover.ts`: Node-only UltraHonk proving and verification for the standalone circuits |
| `lib/community-apps/` | Community apps sandbox: a separate document served with CSP `sandbox allow-scripts` and no network |
| `scripts/` | Tooling: testnet wallet script, artifact checks, copy checks |
| `test/` | Vitest and Hardhat tests |
| `docs/` | Specifications, the engineering plan (`docs/zk/`) and the Aztec dossier |

---

## 3. What the tests show, and what they do not

| Property | Evidence | Limit |
|---|---|---|
| Wallet keys never leave the device | `test/key_custody.test.ts`, `test/pxe_boundary_security.test.ts` | Unit tests of the key helpers, not an end-to-end audit |
| MLS forward secrecy and post-compromise security | Provided by XMTP | `test/mls_post_compromise.test.ts` models an MLS key schedule inside the test file; it does not exercise the app or XMTP |
| Standalone circuits reject the cases their asserts cover | `test/circuits/`, `test/unit/aztec/circuit-proving.test.ts` (real proving) | Each test proves one withdrawal in isolation; ZK-01 shows the streams circuit accepts repeated claims |
| Verification keys are pinned | `test/zk/vk-pinning.test.ts`, `scripts/zk/check-artifacts.mjs` | No on-chain VK registry exists |
| Community apps cannot reach the network or the parent window | `test/eaf_isolation.adversarial.test.ts` | Checks the frame policy; an app can still navigate its own frame |
| L1 contract invariants | `npm run test:contracts` | Local Hardhat tests; no external audit |

---

## 4. Noir circuits (experimental)

The three circuits use `pedersen_hash` and compile with nargo 1.0.0. The binary verification keys were generated with @aztec/bb.js 5.3.0 and their SHA-256 hashes are pinned in `lib/aztec/verifier.ts`.

| Circuit | Pinned VK SHA-256 |
|---|---|
| `escrow` | `0x4e3cc4c8ce03607dcb2b98bd50c0d31084300634ee8f70f4674919682eb915c2` |
| `identity` | `0xcd02d2407de202d61e1a03c360633a9b0cdd8fe4b4d67b007cce108990632194` |
| `streams` | `0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346` |

Known soundness issues of v1, documented in [`docs/zk/MASTER_PROMPT.md`](docs/zk/MASTER_PROMPT.md):

* **ZK-01 (critical):** the streams circuit does not chain state, so the same accrual can be claimed many times. `test/circuits/streams_zk01_known_issue.test.ts` reproduces it.
* **ZK-02 (critical):** escrow and streams proofs are not bound to the address that receives the funds.
* **ZK-03:** claiming an escrow requires the sender's secret; there is no refund path.
* **ZK-04, ZK-05:** the identity circuit lacks domain separation and has an anonymity set of two.
* **ZK-06, ZK-07:** timestamps are chosen by the prover; verification must use the pinned VK (now enforced in `lib/zk/prover.ts`).

**v2 circuits (experimental).** `circuits/escrow_v2`, `circuits/identity_v2` and `circuits/streams_v2` (with the shared `circuits/hl_lib`) fix ZK-01 to ZK-05 and close gaps G2 (committed sanction list), G3 (depth-32 identity tree) and G5 (Poseidon2 with domain separators). They compile and pass their tests in CI (workflow "Noir circuits") but are not pinned and need a verifier that stores state: see [`docs/zk/V2_CIRCUITS.md`](docs/zk/V2_CIRCUITS.md).

The long-term plan is to replace escrow, streams and identity with aztec-nr contracts (tasks R-08 to R-10; API notes in [`docs/zk/AZTEC_NR_V6_NOTES.md`](docs/zk/AZTEC_NR_V6_NOTES.md)), not to deploy any of these circuits.

---

## 5. Layer 1 contracts

Solidity contracts for the Cancun EVM live in `contracts/`. None has had an external audit and none is deployed to mainnet.

* **`HumanityTimeLockVault.sol`:** per-user dead-man switch vault that releases a token balance to a backup wallet after a timeout.
* **`LedgerDeadmanSwitch.sol`:** inheritance switch with a minimum inactivity threshold and a two-step backup change.
* **`ZKIdentityRegistry.sol`:** anchors identity roots. `verifyCredential` always reverts (`VerifierNotConnected`) until a real proof verifier is connected; it used to accept any proof.

`scripts/verify-l1-bytecode.ts` scans bytecode for known drain patterns. It is a lint, not an audit.

---

## 6. Explicit non-claims

1. **No quantum resistance.** BN254, secp256k1 and Curve25519 are not quantum resistant.
2. **No traffic-analysis protection.** MLS protects message content, not IP addresses, sizes or timing.
3. **Testnet only.** No external security audit has concluded. Not production ready.
4. **No formal verification.** Tests and fuzzing are not machine-checked proofs.

---

## 7. Reproduce

Requires Node 22.22.2 or later and, for the circuits, nargo 1.0.0.

```bash
git clone https://github.com/humanityledger/Humanity-Ledger.git
cd Humanity-Ledger
npm ci

# Circuits: types, tests, and that the committed artifacts are the compiled ones
for c in escrow identity streams; do (cd circuits/$c && nargo check && nargo test); done
node scripts/zk/check-artifacts.mjs
for c in hl_lib escrow_v2 identity_v2 streams_v2; do (cd circuits/$c && nargo test); done

# Proving, VK pinning and the ZK-01 reproduction
npx vitest run test/unit/aztec/circuit-proving.test.ts test/zk/ test/circuits/ test/aztec_vk_integrity.test.ts

# Contracts
npm run test:contracts

# Everything else
npx vitest run
```

Test counts are not kept in this file; run the commands or read the latest CI run.

---

## 8. Governance

* **Contributing:** [`CONTRIBUTING.md`](CONTRIBUTING.md)
* **Security policy:** [`SECURITY.md`](SECURITY.md)
* **License:** [`LICENSE`](LICENSE). Proprietary, source available for evaluation and study.
* **Vulnerability disclosure:** [`docs/BUG_BOUNTY.md`](docs/BUG_BOUNTY.md)
* **Contact:** `humanityledger@icloud.com`
