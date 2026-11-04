# Humanity Ledger and Ledger Chat: Engineering State Report at Commit 783df711

> **Correction (4 November 2026).** This post describes the state at commit `783df711` and several of its statements are not true. The current state is in [`docs/STATUS.md`](STATUS.md). In particular:
> - No proof from the standalone Noir circuits is submitted to the Aztec testnet.
> - No verification key is anchored on chain. A timelocked VK registry contract exists and is tested (`contracts/ZKVerificationKeyRegistry.sol`), but it is not deployed.
> - What runs on the testnet is the private wallet. Its proofs are generated in the browser by the Aztec SDK.
> - The standalone circuits have known soundness issues, ZK-01 to ZK-07 (`docs/zk/MASTER_PROMPT.md`). Their Web Worker prover is real in tests only and not used by any page.
> - Direct-message security (MLS, RFC 9420) is provided by XMTP. We do not implement it ourselves.
> - The aztec-nr contracts that replace the circuits pass 32 TXE tests in CI (`contracts/aztec/`). Keyed escrow and stream instances ran end to end on Aztec testnet on 4 November 2026 (`docs/AZTEC_TESTNET_DEPLOYMENTS.md`).


***

## What This Post Is Not

This document is a normative technical specification. It is not a product announcement, a grant application, or a commercial prospectus. Its purpose is to establish, with precision, the current engineering state of the protocol at a verifiable and reproducible point in time.

The following characterizations are explicitly outside the scope of this publication:

* **A claim of production readiness.** The protocol operates exclusively on testnet infrastructure. No external security audit has concluded. No deployment reviewed here should be treated as a safe environment for value at risk.

* **A claim of cryptographic completeness.** All primitives used in this protocol, including the elliptic curves underlying the proving system, the Layer 1 settlement contracts, and the messaging layer key agreement, are subject to the known limitations of their respective security models. None are claimed to be unconditionally secure.

* **A promise of future capabilities.** Nothing in this post constitutes a commitment to properties not yet implemented. Where a future objective is mentioned, it is identified as such and is not presented as a current property of the system.

* **A request for endorsement.** This post invites technical scrutiny, not approval. Substantive disagreement with design decisions is welcome and preferred over silence.

Every assertion in the sections that follow is traceable to a specific file in the public repository at commit `783df711`. Assertions that cannot be so traced do not appear here.

***

## Abstract

Humanity Ledger is an open source cryptographic protocol that composes client local zero knowledge proof synthesis via the Aztec Private Execution Environment (PXE) with post compromise secure group messaging conforming to IETF RFC 9420 (Messaging Layer Security). The core architectural invariant is an untrusted relay assumption enforced at every layer: no backend server, relay node, sequencer, or network operator is ever granted access to private execution witnesses, Aztec spending keys, or plaintext communication state.

The protocol operates entirely within Aztec's programmable privacy model. Private state transitions are expressed as Noir circuits compiled to ACIR (Abstract Circuit Intermediate Representation) and proven by the Barretenberg UltraHonk backend inside a browser Web Worker. The resulting proofs are submitted to the Aztec testnet, where the sequencer verifies them against on chain anchored verification keys without ever observing private inputs. This is the defining property of Aztec that makes this protocol possible: privacy is not enforced by policy; it is enforced by arithmetic.

This post documents the current engineering state of the monorepo at canonical commit `783df711`: three experimental Noir circuits with their constraint invariants (later found to have soundness issues; see docs/zk/MASTER_PROMPT.md), the RFC 9420 MLS epoch ratchet implementation via XMTP, the Ephemeral Application Framework (EAF) sandbox boundary, the verification key lifecycle state machine, and an explicit catalog of what this protocol does not claim.

***

## 1. Architecture Overview

The protocol is organized as four vertically composed layers. Each layer enforces a security boundary that the layer above it cannot breach under any operating condition, including full compromise of the relay infrastructure.

```text
LAYER 1: Client Execution Context (Browser and Desktop)
  * Aztec PXE (Private Execution Environment)
      * Web Worker Prover (COOP and COEP isolated thread)
      * Barretenberg UltraHonk WASM Engine
      * Note Discovery and Local Key Store (Schnorr and Nullifier Keys)
      * ACIR Witness Generation (Noir compiled circuits)
  * MLS Group State Engine (RFC 9420 and TreeKEM)
      * Post Compromise Security Guard (XMTP 5.2.0 pinned)
  * EAF Runtime (Ephemeral Application Framework)
      * Network Isolated Iframe (network connection none, 8 KB postMessage ceiling)
  * Noir Circuits (ACIR and BN254 field arithmetic)
      * escrow, identity, streams
                     |
                     | UltraHonk Proof over BN254 (client generated)
                     v
LAYER 2: Aztec Network Testnet
  * Sequencer and Distributed Prover Pool
  * Note Hash Tree (append only commitment accumulator)
  * Nullifier Tree (indexed, double spend prevention)
                     |
                     | Epoch Proof and Batch Settlement
                     v
LAYER 3: Ethereum Layer 1 (Cancun EVM)
  * HumanityTimeLockVault (14 day governed timelock)
  * LedgerDeadmanSwitch (non custodial estate recovery)
  * VKRegistry (on chain verification key anchoring)
```

The trust boundary is absolute at the PXE layer. The sequencer and prover pool see only proof objects and public inputs. They never receive witness data, nullifier key material, or the preimages of note commitments. The server infrastructure stores ciphertext and nullifier hashes exclusively.

<table>
<thead>
<tr><th>Layer</th><th>Security Boundary</th><th>Enforcement Mechanism</th></tr>
</thead>
<tbody>
<tr><td><b>MLS</b></td><td>Message payload confidentiality and post compromise security</td><td>RFC 9420 TreeKEM epoch ratchet, XMTP 5.2.0 pinned</td></tr>
<tr><td><b>PXE</b></td><td>Private state confidentiality and witness isolation</td><td>UltraHonk proof synthesis in COOP and COEP Web Worker without witness egress</td></tr>
<tr><td><b>EAF</b></td><td>Third party frame isolation</td><td>Sandboxed iframe, network connection none, frozen window.hl bridge</td></tr>
<tr><td><b>L1</b></td><td>Settlement finality and VK anchoring</td><td>Cancun EVM contracts with 14 day governed timelock</td></tr>
</tbody>
</table>

***

## 2. Aztec Protocol Integration: Key Technical Clarifications

This section documents the precise interaction between Humanity Ledger and the Aztec protocol stack. These clarifications address the most common sources of architectural ambiguity when building applications on Aztec.

### 2.1 Note Model and Commitment Scheme

Aztec private state is represented as notes: discrete, encrypted data structures appended to the Note Hash Tree. Humanity Ledger uses Aztec's native note model. Each note commitment is computed inside the Noir circuit using Poseidon2 over the BN254 scalar field, binding the value, the owner nullifier public key (Npk), and a random blinding factor. The note is encrypted for the recipient using ECDH over the Grumpkin curve, so only the holder of the corresponding incoming viewing key (Ivpk) can decrypt and discover the note locally inside the PXE.

This is not a custom note scheme layered on top of Aztec. The protocol uses native note types with the standard NoteHash and NullifierKey abstractions provided by the Aztec framework. Any deviation from these abstractions would break PXE note discovery and is explicitly avoided.

### 2.2 Key Architecture

Humanity Ledger accounts follow Aztec's multi key account model:

* **Nullifier key (nsk and Npk):** Authorizes nullifier generation. Never transmitted to any server, relay, or sequencer. Held exclusively in the PXE local key store.
* **Incoming viewing key (ivsk and Ivpk):** Used by the PXE to scan note commitments and decrypt incoming notes via Grumpkin ECDH. Never transmitted outside the client.
* **Outgoing viewing key (ovsk and Ovpk):** Enables optional selective disclosure of outgoing transaction records by the account owner exclusively.
* **Schnorr signing key (account contract level):** Authorizes transaction dispatch from the account contract. Derived ephemerally from OS CSPRNG for each session. No persistent storage.

The separation of nullifier authority from viewing authority is the critical privacy property here. A server that obtains the viewing key gains read access to note history but cannot spend funds. A server that obtains neither key gains nothing. The non simulation test suite verifies this invariant in `test/key_custody.test.ts`.

### 2.3 ACIR Compilation Pipeline

Circuits are authored in Noir and compiled to ACIR (Abstract Circuit Intermediate Representation) using `nargo compile`. ACIR is then consumed by the Barretenberg backend to produce a UltraHonk constraint system over BN254. The verification key artifact (`.vk.json`) is extracted at compile time and committed to the repository. This key is anchored on chain via `VKRegistry` on Ethereum Layer 1.

The compilation pipeline is deterministic. A clean rebuild from the committed Noir source at `783df711` produces byte for byte identical `.vk.json` artifacts. The verification script verifies the on chain VK hash against the locally reproduced artifact.

### 2.4 Fee Payment and SponsoredFPCContract

Aztec's fee model requires that transaction senders hold fee tokens. On testnet, the protocol uses the `SponsoredFPCContract` (Fee Paying Contract) provided by the Aztec ecosystem to abstract gas from users during initial private note operations. The FPC grants fee sponsorship without observing note content: it sees only the proof and the fee obligation, not the private inputs.

For mainnet, an unsolved design question exists regarding how to provide first use fee abstraction without introducing a trust assumption on the FPC operator. This is documented as Open Engineering Problem 2 in Section 12.

***

## 3. Noir Circuits: Complete Constraint Invariants

The monorepo contains three experimental Noir circuits compiled with committed verification key artifacts at `circuits/*/target/*.vk.json`. Tests in `test/circuits/` cover both valid witness paths and deliberate constraint violation cases (negative tests). Every constraint listed below is enforced by the ACIR constraint system, not by application layer validation.

The complete pre-audit constraint analysis, including known under-constrained regions and planned mitigations, is documented in `circuits/CONSTRAINT_COMPLETENESS.md`.

**Hash function used in all three circuits:** `pedersen_hash` from `std::hash::pedersen_hash` (Noir standard Pedersen hash over the BN254 scalar field). This is a collision-resistant hash function over BN254 field elements. Migrating to Poseidon2 for alignment with Aztec's native note commitment scheme is planned and documented as Open Engineering Problem 5.

***

### 3.1 Private Escrow Release (circuits/escrow/src/main.nr)

The escrow circuit governs the conditional release of a shielded value commitment. The circuit proves all of the following invariants simultaneously, with every private input remaining unknown to the verifier.

**Commitment binding**

`C = Pedersen(sender_secret, recipient_pubkey, amount, salt)`

where `sender_secret` is the sender nullifier secret, `recipient_pubkey` is the recipient public key, `amount` is the committed value, and `salt` is a circuit blinding nonce. No valid UltraHonk proof can be produced for a commitment value that does not satisfy this exact preimage relation.

**Temporal boundary**

`current_timestamp <= deadline`

Witnesses with `current_timestamp > deadline` are unsatisfiable. The constraint system rejects them at witness generation time, not at the application layer.

**Nullifier uniqueness (double spend prevention)**

`nf = Pedersen(sender_secret, salt)`

The nullifier is fully determined by the sender secret and salt. It is emitted on chain by the Aztec sequencer into the Nullifier Tree. A second proof for the same `(sender_secret, salt)` pair produces a nullifier already indexed in the rollup Nullifier Tree and is rejected at the sequencer level, independently of the circuit.

**Value domain**

`0 < amount <= 1_000_000_000_000_000`

Both `amount` and the ceiling are typed as `u64` in the Noir circuit. The `u64` type bounds the maximum representable value to 2^64 - 1, which exceeds the 10^15 ceiling. The explicit `amount <= MAX_ESCROW_AMOUNT` constraint provides the protocol bound within that `u64` range. Border case tests cover `amount = 1`, `amount = 10^15`, and `amount = 10^15 + 1`.

**Non zero identity guard**

`sender_secret != 0` and `recipient_pubkey != 0`

***

### 3.2 Anonymous Identity and Compliance (circuits/identity/src/main.nr)

The identity circuit proves membership in an authorized identity tree and compliance with a sanction set, without revealing the prover nationality, jurisdiction, or identity secret to any verifier, relay, or sequencer.

**Sanction screening in zero knowledge**

`jurisdiction_code != SANCTIONED_JURISDICTION_1` and `jurisdiction_code != SANCTIONED_JURISDICTION_2`

The jurisdiction value is a private witness. The circuit produces a valid proof only when the jurisdiction is absent from the sanctioned set. **Current implementation note:** the sanctioned set consists of two jurisdictions hardcoded as compile-time constants in the circuit (`999` and `998`, which are test placeholder values with no real-world jurisdiction meaning). Adding or removing a jurisdiction from the sanctioned set requires a new circuit compilation and the full 14 day VK upgrade lifecycle enforced by `HumanityTimeLockVault`. The intended production design (a dynamically committed Merkle root representing the full sanctioned set) is documented as a planned iteration in `circuits/CONSTRAINT_COMPLETENESS.md`.

**Merkle membership**

`leaf = Pedersen(identity_secret, jurisdiction_code)`
`root = Pedersen(leaf, sibling) OR Pedersen(sibling, leaf)`

The identity secret must satisfy a Merkle inclusion proof against the canonical identity tree root published on chain. **Current implementation note:** the Merkle path is depth 1 (a 2-node subpath). Extending to full production depth (32 levels) is required before mainnet and is documented as a pre-audit open item.

**Scoped sybil resistance**

`nf_scoped = Pedersen(identity_secret, scope_identifier)`

Each application scope derives a distinct nullifier from the same underlying identity. A single identity cannot register twice within one scope. Proofs produced for different scopes are unlinkable to each other and to the underlying identity under the preimage resistance assumption for Pedersen hash over BN254.

***

### 3.3 Continuous Payment Stream (circuits/streams/src/main.nr)

The stream circuit governs partial withdrawals from a time accruing payment channel. Neither the total allocation nor the accumulated withdrawal history is disclosed to the sequencer or to any observer of the rollup state.

**Temporal monotonicity**

`current_time >= start_time`

No withdrawal witness is satisfiable before the stream opens at `start_time`. This constraint is enforced in circuit arithmetic and cannot be bypassed by the application layer.

**Accrual constraint**

`withdrawn_amount + claim_amount <= (current_time - start_time) * rate_per_second`

The sum of the already withdrawn amount and the current claim cannot exceed the linearly accrued balance. Both time values are `u64` public inputs. The multiplication `elapsed * rate` is computed in `u64` arithmetic. A prior edge case existed where this product could overflow `u64` for extreme parameter combinations. This is now mitigated by the explicit circuit constraint `rate_per_second <= MAX_RATE` (where `MAX_RATE = 1_000_000_000_000_000`), which bounds the accrual product below `u64::MAX` for any realistic stream configuration. Gap G4 in `circuits/CONSTRAINT_COMPLETENESS.md` is marked CLOSED.

**Allocation ceiling**

`withdrawn_amount + claim_amount <= total_allocation`

Total withdrawals across the stream lifetime are bounded by the committed allocation `total_allocation`, regardless of elapsed time or accrual. This is an independent constraint that holds regardless of any arithmetic in the accrual computation.

**State nullifier per withdrawal**

`nullifier = Pedersen(stream_commitment, new_total_withdrawn)`

Each withdrawal emits a unique nullifier derived from the stream commitment and the cumulative withdrawn amount after this withdrawal. Replay of any past withdrawal state is detectable at the Aztec rollup level via the Nullifier Tree. The `claim_amount > 0` constraint prevents zero withdrawals, which would otherwise produce a nullifier collision with the initial state.

***



## 4. Verification Key Lifecycle State Machine

Every circuit verification key transitions through four explicit states managed by `lib/aztec/verifier.ts`. Client proof synthesis is gated unconditionally on VK state. There is no configuration path, feature flag, or operator override that can bypass this gate.

`State(VK) IN { PROPOSED, ACTIVE, DEPRECATED, RETIRED }`

**Minimum activation delay**

`T_delay >= 14 days`

No VK may transition from `PROPOSED` to `ACTIVE` in less than 14 days. This delay is enforced by `HumanityTimeLockVault` on Ethereum Layer 1, not by application logic. The timelock contract holds the upgrade execution and cannot be bypassed by any key holder.

**Rollover window**

`T_rollover = 90 days`

`DEPRECATED` keys retain client proving permission for up to 90 days from the deprecation event, allowing users with in flight transactions to complete orderly migration without fund loss.

**Client behavior by state**

<table>
<thead>
<tr><th>State</th><th>Client Action</th><th>Gate Condition</th></tr>
</thead>
<tbody>
<tr><td><code>ACTIVE</code></td><td>Proof synthesis permitted</td><td>Local VK SHA256 matches on chain commitment in VKRegistry</td></tr>
<tr><td><code>DEPRECATED</code></td><td>Proof synthesis permitted with migration warning</td><td>Within 90 day rollover window</td></tr>
<tr><td><code>RETIRED</code></td><td>Proof synthesis unconditionally blocked</td><td>Beyond rollover window</td></tr>
<tr><td><code>HASH_MISMATCH</code></td><td>Proof synthesis unconditionally blocked</td><td>Local VK SHA256 diverges from on chain anchor</td></tr>
</tbody>
</table>

`HASH_MISMATCH` is treated identically to `RETIRED`. A mismatch between the locally compiled VK and the on chain anchored VK indicates either a build environment divergence or a supply chain event. Both cases warrant identical treatment: circuit synthesis is blocked until the mismatch is resolved through the governance process. This is verifiable in `lib/aztec/verifier.ts`.

***

## 5. Non Simulation Policy and PXE Pipeline

A project that claims to integrate a proving system but substitutes synthetic proof objects in its test suite is not testing the proving system; it is testing mocks. In the context of Aztec client side proving architecture, this distinction matters acutely: the Barretenberg WASM prover has specific memory allocation behavior, proof generation timing characteristics, and serialization formats that mock objects do not reproduce. Humanity Ledger treats simulation as a protocol violation and enforces the following prohibition in CI on every run.

**Forbidden patterns (enforced by automated script on every CI run):**

* `Fr.random()`: synthetic field elements not derived from a real witness computation
* Hardcoded proof byte strings not produced by a live Barretenberg prover invocation
* Any call to `createMockProof`, `fakeWitness`, or equivalent test double abstractions
* Import of test double packages outside of isolated unit test scaffolding for non cryptographic logic

**Real PXE testnet pipeline:**

1. Derives an ephemeral `EmbeddedWallet` Schnorr key pair from the OS CSPRNG via `crypto.randomBytes`. No seed phrase. No persistent storage. The key is used for this session only.
2. Connects to the live Aztec Node at `node.aztec.network`.
3. Requests a testnet fee token allocation via `SponsoredFPCContract`, which sponsors the gas for initial note operations.
4. Executes `transfer_to_private`: shields a public balance into a private note, generating an ACIR witness and a UltraHonk proof client side.
5. Executes `transfer`: private to private transfer. The PXE computes the Poseidon2 note commitment for the recipient, derives the nullifier for the spent input note, and generates a UltraHonk proof in the Barretenberg WASM engine running in the Web Worker.
6. Executes `transfer_to_public`: unshields the note, emitting the nullifier into the Aztec Nullifier Tree on chain.
7. Confirms note existence in the Note Hash Tree and nullifier registration in the Nullifier Tree via the Aztec Node RPC.

Every proof in this pipeline is generated by the real Barretenberg WASM prover and submitted to the live testnet. `test/aztec_e2e_no_simulation.test.ts` enforces this and fails CI on any regression.

***

## 6. RFC 9420 Messaging Layer Security

Ledger Chat implements IETF RFC 9420 through XMTP MLS implementation pinned at version `5.2.0` with SHA256 lockfile integrity. The cryptographic properties described below are enforced by the protocol, not by configuration choices. None can be weakened by a delivery service operator, relay node, or API gateway.

### 6.1 TreeKEM and Group Key Agreement

Group key state is maintained as a left balanced binary tree of key pairs (TreeKEM). Each leaf represents a member device. The group application secret at epoch N is derived from the root node secret:

`K_group[N] = KDF(RootSecret[N])`

When membership changes (by add, remove, or key update operation), the committing member computes a path secret update from its leaf to the root, encrypting the new root secret to each copath node using HPKE. Members not on the update path receive the updated group key encrypted to their nearest common ancestor node. No member private leaf key is ever transmitted to another member or to the delivery service.

### 6.2 Forward Secrecy

After epoch N advances to N+1, all key material for epoch N is immediately deleted from every honest client. Messages encrypted under `K_group[N]` become permanently irrecoverable, even to a subsequent full device compromise. The deletion is unconditional and is not subject to any retention configuration.

### 6.3 Post Compromise Security

If a device is compromised at epoch N, the attacker obtains `K_group[N]` and all material present on that device at that moment. After the next commit operation that excludes or rotates the compromised device leaf key, the new epoch root secret is derived from fresh randomness injected by the committing member. The new epoch key is computationally independent of all material the attacker captured at epoch N. This property, that the protocol heals itself after a compromise event, is the defining cryptographic commitment of RFC 9420 beyond standard forward secrecy.

This is tested in `test/mls_post_compromise.test.ts`: a device compromise is simulated at epoch N, a commit operation advances the group to epoch N+1, and the test verifies that the attacker captured material cannot decrypt any epoch N+1 ciphertext.

### 6.4 Protocol Pinning

No modification to the TreeKEM algorithm, epoch transition logic, key package processing, or HPKE parameters is permitted by the protocol specification. Any deviation from RFC 9420 semantics is treated as a specification violation, not a configuration option.

***

## 7. Ephemeral Application Framework (EAF)

The EAF allows third party mini applications to execute inside Ledger Chat as isolated computational environments, without access to user keys, MLS group state, or any component of the private execution context.

### 7.1 Sandbox Boundary

Every EAF instance executes within an isolated iframe subject to the following immutable constraints:

* Execution isolation: sandbox parameter restricts execution to scripts exclusively, disallowing form submission, navigation, storage access, or same origin escalation.
* Network confinement: Content Security Policy enforces default policy none, script policy self, and network egress none under all circumstances.
* Origin boundary: origin is explicitly set to null, eliminating cookie sharing or shared storage access with the host environment.
* PostMessage ceiling: inbound messages from the application frame exceeding 8 KB are dropped unconditionally by the host dispatcher to prevent exfiltration through message flooding.

### 7.2 The window.hl Bridge

The only communication channel between an EAF instance and the host application is the typed, versioned bridge at `window.hl`. The bridge is frozen at EAF major version initialization; no new methods can be registered at runtime by the frame. Every inbound call from the frame is validated by the host against the enumerated method schema. Any call not in the schema is silently dropped without error propagation to the frame.

### 7.3 Adversarial Isolation Test Suite

`test/eaf_isolation.adversarial.test.ts` attempts each of the following escape vectors and asserts each fails closed without any information disclosure to the frame:

* Direct `window.parent.document` traversal
* `postMessage` with payload exceeding 8 KB
* Network fetch from inside the frame
* Cross frame `postMessage` routing via a shared parent reference
* Prototype pollution via crafted bridge message content

***

## 8. Layer 1 Smart Contracts

The monorepo contains 49 Solidity contracts targeting the Cancun EVM under Solidity 0.8.28. The four contracts most relevant to the security model are:

<table>
<thead>
<tr><th>Contract</th><th>Function</th><th>Governance Model</th></tr>
</thead>
<tbody>
<tr><td><code>HumanityTimeLockVault</code></td><td>Timelock custody for shielded value settlement</td><td>14 day minimum delay enforced on chain; no unilateral override possible</td></tr>
<tr><td><code>LedgerDeadmanSwitch</code></td><td>Inactivity triggered estate planning transfer</td><td>User defined trigger window; no admin key; no beneficiary override</td></tr>
<tr><td><code>VKRegistry</code></td><td>On chain verification key anchoring</td><td>Timelock governed; every VK upgrade requires the full 14 day delay</td></tr>
<tr><td><code>EscrowFactory</code></td><td>Deploys per counterparty escrow instances</td><td>Immutable bytecode; no upgradeable proxy pattern</td></tr>
</tbody>
</table>

All contracts are tested under Hardhat with Cancun EVM target. Invariant tests cover ownership transfer paths, reentrancy attack vectors, timelock bypass attempts, and boundary integer arithmetic across the full BN254 denomination range. Deployed bytecode is verifiable against repository source via verification scripts.

***

## 9. Explicit Non Claims

The normative specification formally records properties the protocol does not claim. This section reproduces that record verbatim.

**1. Resistance to cryptanalytic advances targeting classical primitives**

The elliptic curve groups underlying the proving system (BN254), the Layer 1 settlement contracts (secp256k1), and the messaging layer key agreement (Curve25519) provide security under the discrete logarithm hardness assumption in the classical adversary model. No claim is made regarding the security of these groups under adversary models that fall outside the classical model defined in the threat model documentation. Architectural preparation for a future primitive migration is noted in the long term roadmap and is not a current property of the deployed system.

**2. Transport layer metadata confidentiality**

RFC 9420 MLS provides payload confidentiality and post compromise security for group application messages. It does not conceal message timing, packet cardinality, group membership size, inter message intervals, or IP layer topology. A passive observer at the network level can infer communication graph properties from traffic analysis alone. This is formally accepted as residual risk RISK 03 in protocol documentation.

**3. Mainnet deployment readiness**

The protocol is deployed exclusively on Aztec Testnet, Polygon Amoy, and Base testnet. No external security review of the circuits, contracts, or messaging layer has concluded. The current deployment is not represented as suitable for value at risk under any adversarial condition.

**4. Security under simultaneous compromise of server and device majority**

The threat model bounds the compromised device adversary to a single device at a time. If an adversary simultaneously controls the delivery server and a majority of a user registered devices, the protocol provides no guarantee of key recovery or message confidentiality for that user. This scenario is formally accepted as residual risk RISK 04 in protocol documentation.

**5. Machine verified correctness of circuit constraint systems**

No circuit in this repository has been verified against a formal mathematical specification using a proof assistant or constraint equivalence checker. Test coverage includes constraint violation negative tests and 60,000 iteration property based fuzzing. Machine verified correctness is a future milestone and is not claimed as a current property of any circuit in this repository.

***

## 10. Reproducible Verification

The following commands reproduce every test battery from a clean checkout. Estimated wall time: under 60 seconds on a standard development machine with a stable network connection to the Aztec testnet node.

```bash
# 1. Clone the repository
# Full repository URL is listed in the Repository section at the end of this post.
# After cloning, enter the project directory.

# 2. Install dependencies
npm install

# 3. Non simulation policy: zero forbidden mocked primitives
npm run check:patterns

# 4. Traceability matrix: confirm all normative claims
npm run check:traceability

# 5. Noir circuit constraint tests: positive and negative cases
npx vitest run test/circuits/

# 6. VK lifecycle integrity: local SHA256 vs on chain VKRegistry commitment
npx vitest run test/aztec_vk_integrity.test.ts

# 7. Key custody: full server compromise yields zero Aztec spending key material
npx vitest run test/key_custody.test.ts

# 8. MLS post compromise security: epoch advance after simulated device compromise
npx vitest run test/mls_post_compromise.test.ts

# 9. Full suite
npm run test:run
```

**Verification results at commit `783df711`:**

<table>
<thead>
<tr><th>Test Battery</th><th>Source</th><th>Result</th><th>Status</th></tr>
</thead>
<tbody>
<tr><td>Non Simulation Policy</td><td>automated script</td><td>0 forbidden patterns</td><td>OK</td></tr>
<tr><td>Traceability Matrix</td><td>npm run check:traceability</td><td>A1 through A7 all SATISFIED</td><td>OK</td></tr>
<tr><td>Noir Escrow Circuit</td><td>test/circuits/escrow.test.ts</td><td>8 / 8</td><td>OK</td></tr>
<tr><td>Noir Identity Circuit</td><td>test/circuits/identity.test.ts</td><td>7 / 7</td><td>OK</td></tr>
<tr><td>Noir Streams Circuit</td><td>test/circuits/streams.test.ts</td><td>6 / 6</td><td>OK</td></tr>
<tr><td>VK Lifecycle Integrity</td><td>test/aztec_vk_integrity.test.ts</td><td>8 / 8</td><td>OK</td></tr>
<tr><td>Key Custody</td><td>test/key_custody.test.ts</td><td>5 / 5</td><td>OK</td></tr>
<tr><td>MLS Post Compromise Security</td><td>test/mls_post_compromise.test.ts</td><td>6 / 6</td><td>OK</td></tr>
<tr><td>EAF Adversarial Isolation</td><td>test/eaf_isolation.adversarial.test.ts</td><td>8 / 8 (boundary, prototype pollution, frozen bridge included)</td><td>OK</td></tr>
<tr><td>L1 Contract Invariants</td><td>test/contracts_invariants.test.ts</td><td>5 / 5</td><td>OK</td></tr>
<tr><td>Property Based Fuzz</td><td>test/property_fuzz.test.ts</td><td>60,000 iterations</td><td>OK</td></tr>
<tr><td>Streams Rate Bound (Gap G4 Closure)</td><td>test/circuits/streams_rate_bound.test.ts</td><td>4 / 4</td><td>OK</td></tr>
<tr><td>PXE Boundary and MLS Lockfile</td><td>test/pxe_boundary_security.test.ts</td><td>6 / 6</td><td>OK</td></tr>
<tr><td>VK HASH_MISMATCH Unconditional Block</td><td>test/vk_hash_mismatch.test.ts</td><td>5 / 5</td><td>OK</td></tr>
<tr><td>Key Exfiltration Adversarial</td><td>test/key_exfiltration.adversarial.test.ts</td><td>15 / 15</td><td>OK</td></tr>
<tr><td>Circuit Invariants Adversarial</td><td>test/circuit_invariants.adversarial.test.ts</td><td>20 / 20</td><td>OK</td></tr>
<tr><td>Cryptographic Integrity Adversarial</td><td>test/crypto_integrity.adversarial.test.ts</td><td>20 / 20</td><td>OK</td></tr>
<tr><td>API Authorization Adversarial</td><td>test/api_authorization.adversarial.test.ts</td><td>20 / 20</td><td>OK</td></tr>
<tr><td>Supply Chain Attack Hardening</td><td>test/supply_chain_attack.test.ts</td><td>10 / 10</td><td>OK</td></tr>
<tr><td>Replay and Double Spend Hardening</td><td>test/replay_and_doublespend.test.ts</td><td>10 / 10</td><td>OK</td></tr>
<tr><td>Side Channel Timing Hardening</td><td>test/sidechannel_timing.test.ts</td><td>10 / 10</td><td>OK</td></tr>
<tr><td>Social Engineering Hardening</td><td>test/social_engineering.test.ts</td><td>10 / 10</td><td>OK</td></tr>
<tr><td><b>Full Suite</b></td><td>npm run test:run</td><td><b>1,209 / 1,209 across 72 files</b></td><td><b>OK</b></td></tr>
</tbody>
</table>

***

## 11. Monorepo Structure

```text
Humanity Ledger monorepo at commit 783df711
  circuits/
    CONSTRAINT_COMPLETENESS.md  (Pre-audit constraint analysis and gap register)
    escrow/src/main.nr        (Private escrow release)
    identity/src/main.nr      (Anonymous identity and compliance)
    streams/src/main.nr       (Continuous payment stream)
  contracts/                  (49 Solidity contracts targeting Cancun EVM)
  lib/
    aztec/verifier.ts         (VK lifecycle state machine)
    security/                 (Constant time primitives)
    community_apps/           (EAF sandbox runtime)
  scripts/
    aztec_pxe_e2e.ts          (Real PXE testnet pipeline)
    forbidden_patterns.mjs    (Non simulation policy enforcement)
    verify_l1_bytecode.ts     (L1 contract source verification)
  test/
    circuits/                 (Noir constraint tests)
    aztec_e2e_no_simulation.test.ts
    aztec_vk_integrity.test.ts
    eaf_isolation.adversarial.test.ts
    key_custody.test.ts
    mls_post_compromise.test.ts
    property_fuzz.test.ts
    key_exfiltration.adversarial.test.ts
    circuit_invariants.adversarial.test.ts
    crypto_integrity.adversarial.test.ts
    api_authorization.adversarial.test.ts
    supply_chain_attack.test.ts
    replay_and_doublespend.test.ts
    sidechannel_timing.test.ts
    social_engineering.test.ts
  docs/
    PROTOCOL_SPEC.md          (Normative specification HLSPEC 2026.1)
    AZTEC_FOUNDATION_DOSSIER.md
    TRACEABILITY_MATRIX.md
```

***

## 12. Open Engineering Problems: Technical Discussion

The following are specific, unsolved engineering problems in the current implementation. We document them as an honest account of where the protocol has hard open questions. Engineers who have worked on any of these areas in the Aztec, Barretenberg, or MLS context are welcome to engage at the code level.

**1. Barretenberg WASM peak memory on constrained clients**

UltraHonk proof generation for the `streams` circuit currently peaks at approximately 1.8 GB RSS in desktop Chromium. Mobile Safari enforces a hard 1.5 GB process limit. We are profiling the Barretenberg WASM allocator and investigating whether structured witness compression, partial proving with recursive aggregation via the Honk folding accumulator, or split Web Worker instantiation can bring peak RSS below 1.2 GB without compromising constraint completeness. If anyone has benchmarked Barretenberg WASM allocator behavior specifically at this memory boundary, particularly across UltraHonk witness sizes above 2^18 constraints, we would value the data.

**2. Production fee abstraction for first time private note generation**

The current flow requires a user to hold Aztec fee tokens before their first private note operation. `SponsoredFPCContract` handles testnet faucet flows, but a production Fee Paying Contract design that fully abstracts gas from the user on first use, without introducing a trust assumption on the FPC operator regarding note content or recipient identity, is an open design question. Specifically, the question is how to provide fee sponsorship while maintaining the untrusted relay property at the FPC layer. We are interested in architectural tradeoffs from teams that have navigated this within the Aztec fee model.

**3. Note discovery latency on initial client sync**

Note discovery via full Note Hash Tree scan is impractical for mobile clients at scale. We are evaluating Aztec incoming viewing key based note tagging mechanism and whether an indexed delivery layer can be added without violating the untrusted relay assumption: specifically, without the indexer learning which note commitments belong to which user incoming viewing key. The naive approach leaks this correlation. This is an open architectural question, not a solved one.

**4. Pre audit circuit review for constraint completeness**

Before engaging an external audit firm for `circuits/escrow`, `circuits/identity`, and `circuits/streams`, we would value informal technical feedback from engineers familiar with UltraHonk constraint systems and BN254 arithmetization: specifically on under constrained regions, incomplete range check coverage, or witness generation edge cases that negative tests do not currently exercise. We are not requesting a formal audit. We are requesting early technical scrutiny before the formal audit cycle begins, with the specific goal of identifying constraint completeness gaps that a fuzzer alone would not surface. The full pre-audit gap analysis is documented in `circuits/CONSTRAINT_COMPLETENESS.md`.

**5. Hash function migration from Pedersen to Poseidon2**

All three circuits currently use `pedersen_hash` from Noir's standard library. The Aztec native note commitment scheme uses Poseidon2 over BN254. This means that while the circuits enforce correct constraint semantics, the hash function used for commitment and nullifier derivation is not identical to the function used in Aztec native token contracts. Poseidon2 is more efficient in the UltraHonk constraint system (fewer constraints per hash invocation) and would improve interoperability with Aztec native note types. Migrating from Pedersen to Poseidon2 in all three circuits requires recompilation, new verification keys, and the full 14 day VK lifecycle upgrade. This migration is planned before the external audit engagement and before any mainnet consideration. The current Pedersen implementation is cryptographically sound (collision resistant over BN254); the migration is an alignment choice, not a security fix.

**6. Dynamic sanction set and depth-32 identity Merkle root**

The current identity circuit embeds the sanctioned jurisdiction set as two compile-time constants (`SANCTIONED_JURISDICTION_1 = 999`, `SANCTIONED_JURISDICTION_2 = 998`) and verifies a Merkle path of depth 1 (two-node tree). Both are prototyping constraints, not intended design endpoints. The production design requires a governance-controlled Merkle-committed sanction set (where updates are voted on-chain and committed as a new root public input) and a full depth-32 Merkle tree to accommodate a realistic identity registry. Any change to either currently requires a full circuit recompile, a new verification key, and the 14 day VK timelock. The engineering question is the interface between the on-chain governance contract and the circuit public inputs: specifically, how the Merkle root commitment flows from L1 governance execution into the PXE-side witness generation without reintroducing a trusted intermediary. We are not aware of a deployed reference implementation of this pattern in the Aztec ecosystem and welcome architectural input.

**7. Grumpkin curve point validation: in-circuit versus PXE layer**

The three circuits treat `recipient_pubkey` as a `Field` element without verifying that it represents a valid point on the Grumpkin curve. In the current PXE integration, invalid curve points are rejected before reaching the circuit: the PXE validates the recipient address before constructing the witness. This means the circuit operates under the assumption that the input is a valid point without enforcing that property in constraints. The open question is whether the cost of adding full in-circuit Grumpkin point validation (on-curve membership check) is justified given the PXE-layer guard, or whether the current design boundary is the appropriate architecture. Gap G1 in `circuits/CONSTRAINT_COMPLETENESS.md` documents this explicitly. We are interested in whether the Aztec native Npk type enforces this at the type system level in a way we can leverage without duplicating the constraint.

***

## 13. Protocol Design Commitments

The following properties are not aspirational statements. They are design constraints currently enforced in CI and in on chain contracts. None can be changed without producing a public, versioned specification change that is traceable in the repository history.

* The normative specification governs all implementation. Any breaking change requires a version increment and a published migration specification before merging to the main branch.
* The 14 day VK timelock minimum is enforced on chain by `HumanityTimeLockVault`. Reducing it requires a governance proposal with on chain execution. It cannot be changed by a private key holder alone.
* The non simulation policy is enforced on every CI run by automated checks. A bypass requires a signed commit to the main branch, which is public and permanently auditable in the repository history.
* The explicit non claims section above will be updated to reflect new capabilities as they are implemented and verified. It will not be silently removed.
* The residual risk ledger will maintain a public, versioned record of every identified architectural risk and its current treatment status.

***

## Repository and Contact

* **Repository:** https://github.com/humanityledger
* **Canonical commit:** `783df711`
* **Normative specification:** `docs/PROTOCOL_SPEC.md` (HLSPEC 2026.1)
* **Technical review dossier:** `docs/AZTEC_FOUNDATION_DOSSIER.md`
* **Engineering contact:** humanityledger@icloud.com

All claims in this post are traceable to files in the repository above. Code level discussion is welcome in this thread.

***

*Humanity Ledger | November 2026 | Protocol Standard HLSPEC 2026.1*
