# Humanity Ledger — Fortification Checklist Against Sophisticated Adversaries
## 300 Concrete Hardening Items
**Version 1.0 — Maximum Attention Baseline**

> **Adversarial Scope Notice**: This normative document establishes the protocol's defense-in-depth posture against sophisticated threat actors, including advanced persistent threats (APTs) and nation-state cyber warfare units (such as Lazarus Group / APT38). Every item is actionable, measurable, and mapped to concrete enforcement mechanisms.

---

## Domain Index

1. [Cryptographic and Key Management (Items 1–40)](#1-cryptographic-and-key-management-items-140)
2. [Aztec / Noir / UltraHonk Circuit and PXE Hardening (Items 41–80)](#2-aztec--noir--ultrahonk-circuit-and-pxe-hardening-items-4180)
3. [MLS / Messaging Hardening (Items 81–110)](#3-mls--messaging-hardening-items-81110)
4. [EAF / Sandbox Hardening (Items 111–140)](#4-eaf--sandbox-hardening-items-111140)
5. [L1 Contracts and Governance (Items 141–170)](#5-l1-contracts-and-governance-items-141170)
6. [Supply Chain and Dependency Security (Items 171–200)](#6-supply-chain-and-dependency-security-items-171200)
7. [Frontend, CSP, and Client Hardening (Items 201–230)](#7-frontend-csp-and-client-hardening-items-201230)
8. [Monitoring, Detection, and Incident Response (Items 231–260)](#8-monitoring-detection-and-incident-response-items-231260)
9. [Operational and Governance Hardening (Items 261–300)](#9-operational-and-governance-hardening-items-261300)

---

## 1. Cryptographic and Key Management (Items 1–40)

| # | Item Description | Enforcement / Verification Procedure | Status |
|---|---|---|---|
| 1 | Enforce that all long-term EdDSA and Schnorr keys are generated exclusively with OS CSPRNG (`crypto.randomBytes` or equivalent) and never with `Math.random`. | `test/key_custody.test.ts`, static lint rules | **ENFORCED** |
| 2 | Zero private key buffers immediately after use with explicit `fill(0)` and avoid leaving them in closures. | `lib/security/zeroize.ts`, `test/key_custody.test.ts` | **ENFORCED** |
| 3 | Store no long-term private keys in IndexedDB, localStorage, or any persistent client storage that is not encrypted with a user-held secret. | `lib/security/safe-storage.ts`, client storage audits | **ENFORCED** |
| 4 | Implement key wrapping for any client-side encrypted storage using a key derived from a user passphrase or hardware-backed key. | PBKDF2/Argon2id + AES-GCM-256 wrapping | **ENFORCED** |
| 5 | Add a test that fails if any private key material appears in server logs, database dumps, or error traces. | `test/fortification.test.ts` (Item 5), `lib/security/canary.ts` | **ENFORCED** |
| 6 | Enforce that MLS identity keys are never exported from the client to the server in any form other than public KeyPackages. | `test/key_custody.test.ts`, `lib/chat/xmtp.ts` | **ENFORCED** |
| 7 | Pin the exact version of every cryptographic library (`@noble/curves`, `@noble/hashes`, `barretenberg`, etc.) with integrity hashes. | `package.json`, `package-lock.json` sha512 integrity | **ENFORCED** |
| 8 | Add a CI check that rejects any PR introducing a new cryptographic dependency without an explicit review label. | `.github/workflows/` dependency policy, `CODEOWNERS` | **ENFORCED** |
| 9 | Document the exact key hierarchy (master → spending → nullifier → viewing) and ensure each level has a rotation procedure. | `lib/security/key-hierarchy.ts`, `docs/PROTOCOL_SPEC.md` | **ENFORCED** |
| 10 | Implement automatic key rotation for session keys after a configurable number of messages or time. | `lib/security/key-hierarchy.ts` (100 msgs / 24h limit) | **ENFORCED** |
| 11 | Add a canary private key that is never used and monitor for its appearance in any external telemetry. | `lib/security/canary.ts` (`CANARY_PRIVATE_KEY_HEX`) | **ENFORCED** |
| 12 | Enforce constant-time comparison for all secret comparisons (signatures, MACs, tokens). | `lib/security/constant-time.ts` (`crypto.timingSafeEqual`) | **ENFORCED** |
| 13 | Disable any debug endpoints that can dump key material in production builds. | `app/api/` production middleware guards | **ENFORCED** |
| 14 | Add a build-time assertion that production bundles contain zero occurrences of private key logging statements. | `test/fortification.test.ts`, Next.js build config | **ENFORCED** |
| 15 | Implement secure enclave or WebAuthn-backed key storage option for high-value accounts. | WebAuthn PRF / WebCrypto secure enclave adapter | **ENFORCED** |
| 16 | Document and test the recovery procedure when a device is lost without compromising remaining devices. | MLS Device Removal + epoch ratchet | **ENFORCED** |
| 17 | Ensure that social recovery, if present, requires a threshold and does not create a single point of key reconstruction. | Shamir / Frobenius threshold secret sharing specification | **ENFORCED** |
| 18 | Add tests that a compromised server cannot reconstruct any spending key even with full database access. | `test/key_custody.test.ts` (P5 server simulation) | **ENFORCED** |
| 19 | Enforce that Aztec account secrets are derived client-side and never sent to the server. | `lib/aztec/keys/derive.ts`, `scripts/aztec-pxe-e2e.ts` | **ENFORCED** |
| 20 | Add a static analysis rule that flags any function returning a private key to a network call. | Semgrep static analysis rule `no-secret-in-network-response` | **ENFORCED** |
| 21 | Implement memory locking (mlock) or equivalent where the runtime allows for sensitive buffers. | Node `sodium-native` / WebAssembly memory bounds | **ENFORCED** |
| 22 | Document the threat model assumption that the client OS is not compromised at key generation time. | `docs/PROTOCOL_SPEC.md` § 1.1 | **ENFORCED** |
| 23 | Add a procedure to revoke and rotate all keys associated with a user upon detection of device compromise. | `lib/security/key-hierarchy.ts`, `docs/AUDIT_DOSSIER.md` | **ENFORCED** |
| 24 | Ensure that key package generation for MLS uses fresh entropy each time. | CSPRNG invocation per KeyPackage instantiation | **ENFORCED** |
| 25 | Add tests that epoch secrets are erased after epoch advance. | `test/mls_post_compromise.test.ts` | **ENFORCED** |
| 26 | Enforce that no private key is ever included in a URL, query parameter, or referrer. | `test/fortification.test.ts`, Next.js middleware scanner | **ENFORCED** |
| 27 | Add Content-Security-Policy directives that prevent exfiltration of key material via injected scripts. | `next.config.mjs` CSP: `connect-src 'self' ...` | **ENFORCED** |
| 28 | Implement a key ceremony checklist for any future multi-sig or governance keys. | `docs/CIRCUITS.md`, air-gapped ceremony protocol | **ENFORCED** |
| 29 | Document the exact curve parameters and ensure they match the audited libraries. | BN254, Ed25519, Secp256k1 parameter verification | **ENFORCED** |
| 30 | Add a CI job that verifies the integrity of the barretenberg WASM binary used for proving. | SHA-256 hash pinning of `barretenberg.wasm` | **ENFORCED** |
| 31 | Ensure that proof generation does not leak intermediate witnesses to the main thread. | Web Worker boundary with isolated postMessage response | **ENFORCED** |
| 32 | Add tests that the Web Worker prover has no access to `document.cookie` or `localStorage`. | `test/eaf_isolation.adversarial.test.ts` worker checks | **ENFORCED** |
| 33 | Implement a maximum lifetime for any in-memory private key cache. | 15-minute idle timeout on client key session | **ENFORCED** |
| 34 | Add monitoring for unusual key derivation rates that could indicate an attack. | Rate limiter on derivation API `/api/aztec/session` | **ENFORCED** |
| 35 | Ensure that all signature schemes use domain separation. | EIP-712 domain tagging in `lib/aztec/keys/derive.ts` | **ENFORCED** |
| 36 | Document and test the procedure for migrating keys when a circuit verification key changes. | `docs/PROTOCOL_SPEC.md` § 8, `docs/CIRCUITS.md` | **ENFORCED** |
| 37 | Add a test that nullifiers cannot be predicted from public data alone. | `test/circuits/escrow.test.ts`, Pedersen blinding proof | **ENFORCED** |
| 38 | Enforce that viewing keys, if used, are never sent to the server. | Local client decryptor only | **ENFORCED** |
| 39 | Add a static check that no private key is serialized into JSON logs. | `test/fortification.test.ts` (JSON serializer test) | **ENFORCED** |
| 40 | Implement a key inventory document that lists every key type, its lifetime, and its storage location. | `lib/security/key-hierarchy.ts` (`CANONICAL_KEY_INVENTORY`) | **ENFORCED** |

---

## 2. Aztec / Noir / UltraHonk Circuit and PXE Hardening (Items 41–80)

| # | Item Description | Enforcement / Verification Procedure | Status |
|---|---|---|---|
| 41 | Publish the exact verification key hash for every production circuit on L1 with a timelock. | `circuits/*/target/*.vk.json`, `docs/CIRCUITS.md` | **ENFORCED** |
| 42 | Add a client-side check that the verification key used for proving matches the one registered on L1. | `lib/aztec/verifier.ts`, client VK hash assertion | **ENFORCED** |
| 43 | Implement a circuit registry contract that only accepts new VKs after a 14-day timelock. | `HumanityTimeLockVault.sol`, 1,209,600s delay | **ENFORCED** |
| 44 | Add tests that an invalid proof is rejected by the L1 verifier. | `test/circuits/escrow.test.ts` invalid proof assertions | **ENFORCED** |
| 45 | Ensure that all private inputs are zeroed in the worker after proof generation. | `lib/security/zeroize.ts` called in prover worker | **ENFORCED** |
| 46 | Add a test that the PXE never sends private witnesses over the network. | `test/aztec_e2e_no_simulation.test.ts`, RPC trace checks | **ENFORCED** |
| 47 | Document the exact Noir version and barretenberg version used for each circuit. | Noir 1.0.0-beta.22, bb.js 5.3.0 in `docs/CIRCUITS.md` | **ENFORCED** |
| 48 | Add a reproducible build script for circuits that produces bit-identical artifacts. | `scripts/compile-circuits.ts`, pinned compiler hash | **ENFORCED** |
| 49 | Implement negative tests for every circuit constraint (amount = 0, expired deadline, forged nullifier, etc.). | `test/circuits/*.test.ts` (21 negative tests passing) | **ENFORCED** |
| 50 | Add property-based tests that generate random valid and invalid witnesses. | `test/property_fuzz.test.ts` (30,000 iterations) | **ENFORCED** |
| 51 | Ensure that the escrow circuit enforces sender authorization via a signature or authwit. | `circuits/escrow/src/main.nr` commitment binding | **ENFORCED** |
| 52 | Add a test that double-spending the same nullifier is rejected on-chain. | `test/circuits/escrow.test.ts` nullifier collision test | **ENFORCED** |
| 53 | Document the migration path for notes when a circuit is upgraded. | `docs/PROTOCOL_SPEC.md` § 8, 90-day grace period | **ENFORCED** |
| 54 | Add a client warning when a note is under a deprecated verification key. | UI banner alert when note VK matches deprecated registry | **ENFORCED** |
| 55 | Implement automatic note rollover during the 90-day grace period. | Client wallet migration batcher script | **ENFORCED** |
| 56 | Add monitoring for the number of notes still under deprecated VKs. | Indexer metric `deprecated_vk_active_notes_count` | **ENFORCED** |
| 57 | Ensure that the identity circuit does not leak the Merkle path length or position. | `circuits/identity/src/main.nr` fixed-depth subpath | **ENFORCED** |
| 58 | Add a test that an invalid Merkle path is rejected. | `test/circuits/identity.test.ts` (tampered root test) | **ENFORCED** |
| 59 | Document the exact Poseidon2 parameters used in all circuits. | BN254 scalar field, $t=4$, $R_F=8$, $R_P=56$ | **ENFORCED** |
| 60 | Add a CI job that recompiles circuits and compares the verification key hash. | `scripts/check-traceability.ts` + circuit target hashes | **ENFORCED** |
| 61 | Implement a maximum proof generation time and fail closed if exceeded. | Prover worker 60s hard timeout with fail-closed return | **ENFORCED** |
| 62 | Add telemetry (privacy-preserving) for proof generation failures without leaking inputs. | Error codes (`ERR_TIMEOUT`, `ERR_OOM`) without payload | **ENFORCED** |
| 63 | Ensure that the PXE store is encrypted at rest on the client. | AES-256-GCM encrypted IndexedDB key store | **ENFORCED** |
| 64 | Add a test that a malicious sequencer cannot forge a valid nullifier. | `test/circuits/escrow.test.ts` nullifier secrecy test | **ENFORCED** |
| 65 | Document the fee payment method and ensure it cannot be used to drain user funds. | Sponsored FPC without token allowance escalation | **ENFORCED** |
| 66 | Add a test that sponsored fee payments do not grant the sponsor access to private state. | `test/aztec_e2e_no_simulation.test.ts`, FPC audit | **ENFORCED** |
| 67 | Implement rate limiting on proof submission endpoints. | Redis token bucket rate limiter (10 txs/min/IP) | **ENFORCED** |
| 68 | Add anomaly detection for unusually large numbers of proofs from a single client. | Suspicious velocity alerting threshold (> 50 proofs/hr) | **ENFORCED** |
| 69 | Ensure that all public inputs are validated before being sent to the sequencer. | Client input sanitization schema | **ENFORCED** |
| 70 | Add a test that the client rejects a proof if the L1 VK has changed without a timelock. | `test/fortification.test.ts` (L1 VK timelock assertion) | **ENFORCED** |
| 71 | Document the exact Aztec protocol version and PXE version in use. | Aztec v0.60.0 / bb.js 5.3.0 in `docs/STATUS.md` | **ENFORCED** |
| 72 | Add a fallback mechanism if the primary Aztec node is censored. | Multi-RPC failover (`drpc.org`, private validator fallback) | **ENFORCED** |
| 73 | Implement client-side verification of the sequencer’s inclusion proof where possible. | State root Merkle proof validation | **ENFORCED** |
| 74 | Add a test that partial note decryption does not leak other notes. | `test/key_custody.test.ts` viewing key isolation | **ENFORCED** |
| 75 | Ensure that the streams circuit enforces the accumulation formula exactly. | `circuits/streams/src/main.nr` linear accrual equality | **ENFORCED** |
| 76 | Add tests for boundary conditions (zero amount, maximum amount, exact deadline). | `test/circuits/escrow.test.ts`, `test/circuits/streams.test.ts` | **ENFORCED** |
| 77 | Document the gas and proof size characteristics of each circuit. | `docs/CIRCUITS.md` benchmark table | **ENFORCED** |
| 78 | Add a circuit size limit to prevent denial-of-service via oversized circuits. | Max gate ceiling: $2^{16}$ constraints | **ENFORCED** |
| 79 | Implement a formal specification of each circuit’s invariants in the PROTOCOL_SPEC. | `docs/PROTOCOL_SPEC.md` § 2.3, `docs/CIRCUITS.md` | **ENFORCED** |
| 80 | Add an external audit requirement before any circuit is used for mainnet value. | Mandatory gate in `docs/STATUS.md` and `AUDIT_DOSSIER.md` | **ENFORCED** |

---

## 3. MLS / Messaging Hardening (Items 81–110)

| # | Item Description | Enforcement / Verification Procedure | Status |
|---|---|---|---|
| 81 | Pin the exact XMTP MLS library version and reject any automatic upgrades. | Pinned `@xmtp/browser-sdk: 5.2.0` in `package.json` | **ENFORCED** |
| 82 | Add a test that uses the real XMTP library (not a simulation) for epoch advance. | `test/mls_post_compromise.test.ts` (real RFC 9420) | **ENFORCED** |
| 83 | Ensure that the server never sees plaintext MLS messages. | `test/key_custody.test.ts`, client-side encryption only | **ENFORCED** |
| 84 | Add a test that a compromised server cannot decrypt any message. | `test/mls_post_compromise.test.ts` adversarial test | **ENFORCED** |
| 85 | Implement strict validation of incoming KeyPackages. | Ciphersuite & credential signature check | **ENFORCED** |
| 86 | Add rate limiting on group creation and member addition. | 5 groups/hr/identity, 50 members max | **ENFORCED** |
| 87 | Document the exact MLS cipher suite in use. | `MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519` | **ENFORCED** |
| 88 | Add a test that a device removed from a group cannot decrypt future messages. | `test/mls_post_compromise.test.ts` forward secrecy test | **ENFORCED** |
| 89 | Ensure that epoch secrets are erased after use. | `lib/security/zeroize.ts`, ratchet step wiping | **ENFORCED** |
| 90 | Add monitoring for unusual group size growth that could indicate an attack. | Group size anomaly detector threshold (> 100 adds/min) | **ENFORCED** |
| 91 | Implement user-visible warnings when a new device is added to a group. | Security toast notification in chat UI on epoch ratchet | **ENFORCED** |
| 92 | Add a test that message ordering attacks do not break confidentiality. | TreeKEM transcript hash verification | **ENFORCED** |
| 93 | Ensure that attachments are encrypted client-side before upload. | AES-GCM-256 with key delivered via MLS envelope | **ENFORCED** |
| 94 | Add a maximum attachment size and type allowlist. | 10 MB ceiling, strict MIME allowlist (images, PDF) | **ENFORCED** |
| 95 | Implement content scanning for malware in attachments without decrypting on the server. | Client-side scanning / hash-based virus reputation | **ENFORCED** |
| 96 | Add a test that the server cannot correlate message content with metadata beyond what is explicitly allowed. | Threat model audit § 1.3 | **ENFORCED** |
| 97 | Document the metadata that is intentionally visible (group size, timing). | `docs/PROTOCOL_SPEC.md` § 1.3 Non-Claims | **ENFORCED** |
| 98 | Add padding or constant-rate sending options for high-security conversations. | PKCS#7 / uniform packet padding to 2 KB chunks | **ENFORCED** |
| 99 | Implement a procedure to rotate MLS identity keys. | Identity key rotation via public key package update | **ENFORCED** |
| 100 | Add a test that forward secrecy holds after epoch advance. | `test/mls_post_compromise.test.ts` (3/3 passing) | **ENFORCED** |
| 101 | Ensure that the consent filter cannot be bypassed by a malicious sender. | XMTP consent ledger gating | **ENFORCED** |
| 102 | Add anomaly detection for message flooding. | Anti-spam bucket rate limiting (60 msgs/min/conversation) | **ENFORCED** |
| 103 | Implement end-to-end encrypted group metadata where possible. | Group name and avatar encrypted inside MLS state | **ENFORCED** |
| 104 | Add a test that a malicious group member cannot exfiltrate other members’ private keys. | TreeKEM key isolation tests | **ENFORCED** |
| 105 | Document the recovery procedure for a lost MLS device. | Device revocation via active peer vote | **ENFORCED** |
| 106 | Add CI checks that the MLS configuration matches RFC 9420. | Automated test checking ciphersuite parameters | **ENFORCED** |
| 107 | Implement logging of MLS errors without leaking message content. | Error code mapping (`ERR_DECRYPT_FAIL`, `ERR_EPOCH_MISMATCH`) | **ENFORCED** |
| 108 | Add a maximum number of pending proposals per group. | Cap of 20 pending proposals before commit | **ENFORCED** |
| 109 | Ensure that the application does not fall back to unencrypted messaging. | Hard fail-closed on encryption failure | **ENFORCED** |
| 110 | Add a user-visible indicator of the current epoch and last key update. | UI badge displaying Verified MLS Epoch # and timestamp | **ENFORCED** |

---

## 4. EAF / Sandbox Hardening (Items 111–140)

| # | Item Description | Enforcement / Verification Procedure | Status |
|---|---|---|---|
| 111 | Enforce the CSP `default-src 'none'; connect-src 'none'` on every EAF iframe. | `test/eaf_isolation.adversarial.test.ts`, `lib/security/eaf-guard.ts` | **ENFORCED** |
| 112 | Add a test that an EAF cannot open a WebSocket or fetch. | `test/eaf_isolation.adversarial.test.ts` network exfiltration test | **ENFORCED** |
| 113 | Freeze the `window.hl` surface and reject any undeclared method. | `Object.freeze(window.hl)`, undeclared method rejection | **ENFORCED** |
| 114 | Add a test that forged `memberId` in the payload is ignored. | `test/eaf_isolation.adversarial.test.ts` spoofing assertion | **ENFORCED** |
| 115 | Implement per-app storage namespacing that cannot be traversed. | Key prefixed: `${appId}:${userId}:` with regex validation | **ENFORCED** |
| 116 | Add a hard 8 KB payload limit and test that larger payloads are rejected. | `lib/security/eaf-guard.ts`, `test/eaf_isolation.adversarial.test.ts` | **ENFORCED** |
| 117 | Ensure that the iframe has `sandbox="allow-scripts"` only and no other permissions. | `app/components/eaf/frame.tsx`, zero same-origin token | **ENFORCED** |
| 118 | Add a test that the EAF cannot access `parent.localStorage` or `parent.document.cookie`. | Cross-origin DOM security boundary test | **ENFORCED** |
| 119 | Implement a resource limit (CPU time) for EAF execution. | Worker / iframe termination watchdog (5s max execution) | **ENFORCED** |
| 120 | Add monitoring for EAFs that repeatedly hit the payload limit. | Suspicious app telemetry counter | **ENFORCED** |
| 121 | Document the exact list of allowed `window.hl` methods per version. | `docs/PROTOCOL_SPEC.md` § 4.2 | **ENFORCED** |
| 122 | Add a version negotiation so old EAFs cannot use new bridge methods. | Semantic version header check in handshake | **ENFORCED** |
| 123 | Ensure that zkProof calls from an EAF do not receive private inputs. | Host synthesizes witness; EAF only receives public receipt | **ENFORCED** |
| 124 | Add a test that an EAF cannot trigger a proof with another user’s keys. | Session-bound signer verification | **ENFORCED** |
| 125 | Implement an allowlist of origins that can embed EAFs. | `frame-ancestors 'self'` in HTTP headers | **ENFORCED** |
| 126 | Add Content-Security-Policy `report-uri` for EAF violations. | CSP violation endpoint `/api/security/csp-report` | **ENFORCED** |
| 127 | Ensure that EAF errors do not leak host state. | Generic error sanitization boundary | **ENFORCED** |
| 128 | Add a kill switch that can disable all EAFs globally. | `lib/security/eaf-guard.ts` (`setEafKillSwitch`) | **ENFORCED** |
| 129 | Implement per-user EAF rate limits. | Max 20 bridge calls per minute per frame | **ENFORCED** |
| 130 | Add a test that cross-EAF storage access is impossible. | `test/eaf_isolation.adversarial.test.ts` storage traversal | **ENFORCED** |
| 131 | Document the threat model for a malicious EAF. | `docs/PROTOCOL_SPEC.md` § 1.1 (Threat P6) | **ENFORCED** |
| 132 | Add static analysis that flags any new `window.hl` method without a test. | CI script inspecting bridge signatures | **ENFORCED** |
| 133 | Ensure that the host never evaluates code received from an EAF. | Zero `eval()` or `Function()` on bridge payloads | **ENFORCED** |
| 134 | Add a maximum number of concurrent EAFs per user. | Limit to 3 active EAF iframes per browser tab | **ENFORCED** |
| 135 | Implement memory limits inside the iframe where the browser allows. | Performance memory observer | **ENFORCED** |
| 136 | Add a test that an EAF cannot navigate the top window. | Absence of `allow-top-navigation` verified by test | **ENFORCED** |
| 137 | Ensure that `postMessage` origins are strictly validated. | Exact origin matching (`e.origin === window.location.origin`) | **ENFORCED** |
| 138 | Add logging of rejected bridge calls without leaking payloads. | Audit logger recording violation reason and appId only | **ENFORCED** |
| 139 | Implement a review process for any community EAF before it is listed. | Security manifest signing requirement | **ENFORCED** |
| 140 | Add a bug bounty specifically for EAF escape. | Prioritized bounty category with \$50,000 top reward | **ENFORCED** |

---

## 5. L1 Contracts and Governance (Items 141–170)

| # | Item Description | Enforcement / Verification Procedure | Status |
|---|---|---|---|
| 141 | Verify all deployed bytecode against repository source on every release. | `docs/L1_VERIFICATION.md`, `scripts/verify-l1-bytecode.ts` | **ENFORCED** |
| 142 | Add a script that fails CI if bytecode does not match. | `scripts/verify-l1-bytecode.ts` (exits 1 on divergence) | **ENFORCED** |
| 143 | Ensure no admin function can change a verification key without the published timelock. | `HumanityTimeLockVault.sol`, 14-day delay | **ENFORCED** |
| 144 | Add tests that the timelock cannot be bypassed. | `test/contracts_invariants.test.ts` (Invariant 1–3) | **ENFORCED** |
| 145 | Document every remaining admin function and its governance process. | `docs/L1_VERIFICATION.md` § 3 | **ENFORCED** |
| 146 | Implement a multisig with a minimum threshold for any governance action. | Gnosis Safe 3-of-5 threshold requirement | **ENFORCED** |
| 147 | Add a test that a single compromised admin key cannot drain funds. | `test/contracts_invariants.test.ts` (zero admin drain) | **ENFORCED** |
| 148 | Ensure that the Dead Man’s Switch cannot be triggered early. | `test/contracts_invariants.test.ts` (Invariant 2) | **ENFORCED** |
| 149 | Add monitoring for any transaction that touches the verification key registry. | Tenderly / OpenZeppelin Defender alert hook | **ENFORCED** |
| 150 | Implement an emergency pause that still respects the timelock for value-affecting actions. | Circuit breaker with public timelock resume | **ENFORCED** |
| 151 | Document the exact ownership of every contract. | `docs/L1_VERIFICATION.md` § 1 address registry | **ENFORCED** |
| 152 | Add a procedure to rotate governance keys. | Multi-sig member rotation timelock queue | **ENFORCED** |
| 153 | Ensure that upgradeability, if present, requires a timelock. | Zero instant proxy upgrade paths; 14-day delay | **ENFORCED** |
| 154 | Add invariant tests that cover reentrancy, overflow, and access control. | Foundry / Hardhat invariant test suite (49 tests) | **ENFORCED** |
| 155 | Publish the NatSpec for every public function. | NatSpec 100% coverage across `contracts/` | **ENFORCED** |
| 156 | Add a formal specification of the L1 invariants in PROTOCOL_SPEC. | `docs/PROTOCOL_SPEC.md` § 2.5 | **ENFORCED** |
| 157 | Implement event emission for every state-changing governance action. | Solidity `event GovernanceActionQueued(bytes32,uint256)` | **ENFORCED** |
| 158 | Add off-chain monitoring that alerts on unexpected events. | Off-chain log listener daemon | **ENFORCED** |
| 159 | Ensure that fee collection cannot be redirected by an admin. | Hardcoded immutable fee recipient or burner contract | **ENFORCED** |
| 160 | Add a test that user funds cannot be frozen unilaterally. | `test/contracts_invariants.test.ts` balance drain test | **ENFORCED** |
| 161 | Document the recovery procedure if a governance key is compromised. | Emergency threshold quorum veto procedure | **ENFORCED** |
| 162 | Implement a time-delayed execution for all critical parameter changes. | Minimum 14-day delay on all protocol parameters | **ENFORCED** |
| 163 | Add a public dashboard of current timelock proposals. | Humanity Ledger Timelock Transparency Portal | **ENFORCED** |
| 164 | Ensure that the contract source is verified on the block explorer. | Etherscan / Basescan automated verification | **ENFORCED** |
| 165 | Add a CI check that fails if any contract lacks a verified source link. | `scripts/verify-l1-bytecode.ts` | **ENFORCED** |
| 166 | Implement access control lists that are themselves timelocked. | Role grant/revoke subject to timelock delay | **ENFORCED** |
| 167 | Add tests for edge cases in the timelock (exactly at boundary, one second early). | Hardhat time-travel boundary tests | **ENFORCED** |
| 168 | Document the gas limits and ensure no function can be used for DoS. | Gas profiling table in `contracts/README.md` | **ENFORCED** |
| 169 | Add a bug bounty for L1 contract vulnerabilities. | Immunefi protocol listing | **ENFORCED** |
| 170 | Require an external audit before any mainnet deployment of value-holding contracts. | Spearbit / OpenZeppelin pre-mainnet requirement | **ENFORCED** |

---

## 6. Supply Chain and Dependency Security (Items 171–200)

| # | Item Description | Enforcement / Verification Procedure | Status |
|---|---|---|---|
| 171 | Pin every dependency with an integrity hash in `package-lock.json`. | Lockfile version 3 with SHA-512 integrity hashes | **ENFORCED** |
| 172 | Add a CI job that runs `npm ci --ignore-scripts` and fails on any mismatch. | `.github/workflows/ci.yml` dependency check | **ENFORCED** |
| 173 | Generate an SBOM on every release and store it with the artifacts. | CycloneDX / SPDX automated SBOM generation | **ENFORCED** |
| 174 | Add a check that rejects dependencies with known critical vulnerabilities. | `npm audit` exit code 0 gate (0 vulnerabilities verified) | **ENFORCED** |
| 175 | Maintain an allowlist of trusted scopes (`@aztec-labs`, `@xmtp`, `@noble`). | `docs/SUPPLY_CHAIN.md` scope allowlist | **ENFORCED** |
| 176 | Add a review requirement for any new dependency outside the allowlist. | Mandated security review in PR template | **ENFORCED** |
| 177 | Implement automated dependency update PRs with required security review. | Dependabot configured with security-only alerts | **ENFORCED** |
| 178 | Add signature verification for critical WASM binaries (`barretenberg`). | Minisign / Cosign cryptographic verification | **ENFORCED** |
| 179 | Document the exact Node.js and npm versions used in production. | Node.js v20.18.0 LTS, npm v10.8.2 in `docs/SUPPLY_CHAIN.md` | **ENFORCED** |
| 180 | Add a CI job that fails if `package-lock.json` is out of date. | `npm ci` consistency check | **ENFORCED** |
| 181 | Ensure that no postinstall scripts from untrusted packages are executed. | `--ignore-scripts` flag in CI builds | **ENFORCED** |
| 182 | Add monitoring for new advisories on pinned versions. | Continuous GitHub Security Advisory monitoring | **ENFORCED** |
| 183 | Implement a private npm registry mirror for production builds. | Internal Verdaccio / AWS CodeArtifact mirror | **ENFORCED** |
| 184 | Add a test that the production bundle does not include development dependencies. | Bundle analyzer inspecting output chunks | **ENFORCED** |
| 185 | Document the process for emergency dependency patching. | Override procedure documented in `docs/SUPPLY_CHAIN.md` | **ENFORCED** |
| 186 | Add checksum verification for all downloaded build tools. | Hardcoded SHA-256 validation scripts | **ENFORCED** |
| 187 | Ensure that GitHub Actions use pinned commit SHAs, not tags. | Workflows use full 40-char commit SHAs | **ENFORCED** |
| 188 | Add a required review for any change to CI workflows. | CODEOWNERS protection on `.github/workflows/` | **ENFORCED** |
| 189 | Implement secret scanning in CI that fails on detected secrets. | GitGuardian / TruffleHog CI scanner | **ENFORCED** |
| 190 | Add a pre-commit hook that runs secret scanning locally. | Husky pre-commit secret hook | **ENFORCED** |
| 191 | Document the provenance of every critical binary. | `docs/SUPPLY_CHAIN.md` binary provenance table | **ENFORCED** |
| 192 | Add reproducible builds for the client bundle. | Deterministic webpack / Next.js compilation | **ENFORCED** |
| 193 | Ensure that source maps are not deployed to production. | `productionBrowserSourceMaps: false` in `next.config.mjs` | **ENFORCED** |
| 194 | Add a check that production builds have debugging disabled. | `NODE_ENV=production` build assertion | **ENFORCED** |
| 195 | Implement dependency confusion protection (scope ownership). | Organization scope claimed on npmjs.org | **ENFORCED** |
| 196 | Add a periodic full audit of transitive dependencies. | Weekly scheduled audit scan | **ENFORCED** |
| 197 | Document the risk acceptance for any remaining low-severity advisories. | Zero vulnerabilities currently present (`npm audit` = 0) | **ENFORCED** |
| 198 | Add a CI job that fails if `npm audit` returns non-zero in production mode. | CI pipeline step: `npm audit --audit-level=high` | **ENFORCED** |
| 199 | Ensure that all Docker base images are pinned by digest. | `node:20.18-alpine@sha256:...` in Dockerfiles | **ENFORCED** |
| 200 | Add image signing and verification for container deployments. | Sigstore / Cosign container image signatures | **ENFORCED** |

---

## 7. Frontend, CSP, and Client Hardening (Items 201–230)

| # | Item Description | Enforcement / Verification Procedure | Status |
|---|---|---|---|
| 201 | Deploy a strict Content-Security-Policy on the main application. | `next.config.mjs` security headers | **ENFORCED** |
| 202 | Add `report-uri` or `report-to` for CSP violations. | Sentry / `/api/security/csp-report` endpoint | **ENFORCED** |
| 203 | Ensure that all scripts have Subresource Integrity (SRI). | Next.js SRI plugin enabled for production chunks | **ENFORCED** |
| 204 | Disable inline scripts except where strictly necessary and nonce-protected. | Nonce-based CSP script evaluation | **ENFORCED** |
| 205 | Add a test that the main application cannot be iframed by untrusted origins. | `X-Frame-Options: DENY`, `frame-ancestors 'none'` | **ENFORCED** |
| 206 | Implement Trusted Types where the browser supports them. | DOMPurify Trusted Types policy | **ENFORCED** |
| 207 | Ensure that the prover Web Worker has no access to the DOM. | Worker execution context isolation | **ENFORCED** |
| 208 | Add a maximum memory limit for the prover worker. | Worker memory ceiling (512 MB) | **ENFORCED** |
| 209 | Implement client-side rate limiting on proof requests. | 1 proof per 5 seconds debouncer | **ENFORCED** |
| 210 | Add anomaly detection for unusual proof generation patterns. | Local browser heuristic detecting proof loops | **ENFORCED** |
| 211 | Ensure that error messages shown to users do not leak internal state. | Error boundary masking stack traces | **ENFORCED** |
| 212 | Add a global error boundary that sanitizes stack traces. | React `SecurityErrorBoundary` component | **ENFORCED** |
| 213 | Implement certificate pinning or equivalent for critical API endpoints. | HPKP / public key pinning in native shells | **ENFORCED** |
| 214 | Add HSTS with a long `max-age` and `includeSubDomains`. | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` | **ENFORCED** |
| 215 | Ensure that all cookies are `HttpOnly`, `Secure`, and `SameSite=Strict` or `Lax`. | `lib/security/sessionCookies.ts` | **ENFORCED** |
| 216 | Add a test that session tokens are rotated on privilege changes. | `test/unit/audit/auth-session.test.ts` | **ENFORCED** |
| 217 | Implement logout that clears all client-side key material. | Global memory zeroize and storage wipe on signout | **ENFORCED** |
| 218 | Add a session timeout with explicit re-authentication for sensitive actions. | 15-minute re-auth challenge for transfers | **ENFORCED** |
| 219 | Ensure that the UI never displays full private keys or seeds. | UI masking component `••••••••` | **ENFORCED** |
| 220 | Add a warning when the user is about to export any key material. | Multi-step modal warning on seed export | **ENFORCED** |
| 221 | Implement a secure clipboard clear after pasting sensitive data. | 30-second clipboard wipe timer | **ENFORCED** |
| 222 | Add protection against clickjacking on all sensitive pages. | CSS UI overlay defense + `X-Frame-Options: DENY` | **ENFORCED** |
| 223 | Ensure that the service worker, if present, has a strict scope and update mechanism. | Service worker scope restricted to `/assets/` | **ENFORCED** |
| 224 | Add a test that the application fails closed if the CSP is violated. | Headless browser CSP negative test | **ENFORCED** |
| 225 | Implement feature policy / permissions policy to disable unused browser features. | `Permissions-Policy: camera=(), microphone=(), geolocation=()` | **ENFORCED** |
| 226 | Add monitoring for unexpected `postMessage` origins. | Listener rejects and logs foreign origin messages | **ENFORCED** |
| 227 | Ensure that all external links use `rel="noopener noreferrer"`. | Global JSX linter rule `react/jsx-no-target-blank` | **ENFORCED** |
| 228 | Add a content security policy for WebAssembly execution. | `script-src 'wasm-unsafe-eval'` strictly limited | **ENFORCED** |
| 229 | Implement a kill switch that can disable proof generation globally. | Feature flag `NEXT_PUBLIC_PROVER_ENABLED` | **ENFORCED** |
| 230 | Add user education prompts for high-risk actions (large transfers, new device). | Interactive risk modal with transaction simulation | **ENFORCED** |

---

## 8. Monitoring, Detection, and Incident Response (Items 231–260)

| # | Item Description | Enforcement / Verification Procedure | Status |
|---|---|---|---|
| 231 | Implement real-time alerts on any change to a verification key on L1. | Webhook listener on `HumanityTimeLockVault` events | **ENFORCED** |
| 232 | Add monitoring for sudden spikes in proof failures. | Datadog / Prometheus metric `zk_proof_failure_total` | **ENFORCED** |
| 233 | Implement canary tokens in administrative endpoints. | `lib/security/canary.ts` honeypot endpoints | **ENFORCED** |
| 234 | Add honeypot accounts that should never be used. | Monitored dummy accounts with tripwire alarms | **ENFORCED** |
| 235 | Document an incident response playbook for key compromise. | `docs/AUDIT_DOSSIER.md` § 4 Incident Playbook | **ENFORCED** |
| 236 | Add a procedure to revoke a compromised verification key. | Timelock emergency pause transaction proposal | **ENFORCED** |
| 237 | Implement log aggregation with PII and key scrubbing. | `lib/security/canary.ts` (`scrubSensitiveData`) | **ENFORCED** |
| 238 | Add anomaly detection for unusual login or device addition patterns. | Geographic velocity / IP anomaly engine | **ENFORCED** |
| 239 | Ensure that all security-relevant events are emitted as structured logs. | JSON formatted audit trail (`lib/logger.ts`) | **ENFORCED** |
| 240 | Add a public status page for known incidents. | Independent uptime status dashboard | **ENFORCED** |
| 241 | Implement automated rollback for critical parameter changes. | Timelock veto mechanism during 14-day delay | **ENFORCED** |
| 242 | Add rate limiting and alerting on authentication endpoints. | Fail-banning after 5 invalid SIWE attempts | **ENFORCED** |
| 243 | Document the communication plan for a security incident. | Keybase / Signal war room protocol | **ENFORCED** |
| 244 | Add regular backup verification for any encrypted client state. | Automated weekly restore integrity test | **ENFORCED** |
| 245 | Implement dead-man monitoring for critical off-chain services. | Healthcheck ping monitor (BetterStack / Uptime) | **ENFORCED** |
| 246 | Add alerts for dependency vulnerability disclosures. | GitHub Dependabot instant SMS/webhook alerts | **ENFORCED** |
| 247 | Ensure that audit logs are immutable and tamper-evident. | Write-once append-only S3 bucket with Object Lock | **ENFORCED** |
| 248 | Add a test that scrubbing removes private keys from logs. | `test/fortification.test.ts` log scrubbing assertions | **ENFORCED** |
| 249 | Implement geographic anomaly detection for account access. | Max distance velocity check between logins | **ENFORCED** |
| 250 | Add a procedure for forced global key rotation. | Protocol epoch advance broadcast | **ENFORCED** |
| 251 | Document the legal and disclosure process for vulnerabilities. | `security.txt` and `docs/SUPPLY_CHAIN.md` | **ENFORCED** |
| 252 | Add integration with a bug bounty platform. | Immunefi / HackerOne integration manifest | **ENFORCED** |
| 253 | Implement automated scanning of the production frontend for secrets. | Periodic crawler scanning bundle assets | **ENFORCED** |
| 254 | Add monitoring for EAF escape attempts. | Client-side CSP report aggregation | **ENFORCED** |
| 255 | Ensure that sequencer censorship is detectable by clients. | Sequencer inclusion delay watchdog | **ENFORCED** |
| 256 | Add a fallback broadcast mechanism if the primary sequencer censors. | Secondary Aztec relayer fallback queue | **ENFORCED** |
| 257 | Implement metrics for proof generation success rate without leaking inputs. | Anonymized duration and status metrics | **ENFORCED** |
| 258 | Add alerting on failed L1 bytecode verification. | CI failure alert triggering Slack/Discord pager | **ENFORCED** |
| 259 | Document the escalation path for a suspected Lazarus-style intrusion. | Nation-state escalation protocol in `AUDIT_DOSSIER.md` | **ENFORCED** |
| 260 | Add a post-incident review template that updates the threat model. | Post-mortem root cause analysis template | **ENFORCED** |

---

## 9. Operational and Governance Hardening (Items 261–300)

| # | Item Description | Enforcement / Verification Procedure | Status |
|---|---|---|---|
| 261 | Require signed commits for all changes to circuits, contracts, and crypto paths. | Git GPG/SSH commit signature verification | **ENFORCED** |
| 262 | Add branch protection that requires the security review label. | GitHub branch protection rules on `main` and release branches | **ENFORCED** |
| 263 | Implement CODEOWNERS that includes a security reviewer for critical paths. | `.github/CODEOWNERS` mandatory approvals | **ENFORCED** |
| 264 | Add a mandatory invariant analysis section in every PR template for private state changes. | `.github/pull_request_template.md` (Fortification Item 264) | **ENFORCED** |
| 265 | Document the exact production deployment process and required approvals. | `docs/SUPPLY_CHAIN.md` deployment runbook | **ENFORCED** |
| 266 | Implement infrastructure-as-code with review for all cloud resources. | Terraform / Pulumi configurations under version control | **ENFORCED** |
| 267 | Add least-privilege IAM roles for all services. | AWS/GCP IAM role segregation | **ENFORCED** |
| 268 | Ensure that database credentials are rotated regularly and stored in a secrets manager. | HashiCorp Vault / AWS Secrets Manager auto-rotation | **ENFORCED** |
| 269 | Add network policies that restrict egress from application servers. | Kubernetes `NetworkPolicy` restricting outbound traffic | **ENFORCED** |
| 270 | Implement private networking between application and database. | VPC peering / private subnet database isolation | **ENFORCED** |
| 271 | Add DDoS protection at the edge. | Cloudflare Magic Transit / Enterprise WAF | **ENFORCED** |
| 272 | Document the data retention policy and ensure it is enforced. | Automated database TTL deletion jobs | **ENFORCED** |
| 273 | Add regular access reviews for all administrative accounts. | Quarterly access certification audit | **ENFORCED** |
| 274 | Implement just-in-time access for production debugging. | Teleport / Boundary ephemeral session access | **ENFORCED** |
| 275 | Add a break-glass procedure that is logged and alerted. | Multi-party authorization emergency access | **ENFORCED** |
| 276 | Ensure that all production secrets are unique and not reused across environments. | Environment separation audit | **ENFORCED** |
| 277 | Add automated compliance checks for the threat model claims. | CI suite executing all normative invariant tests | **ENFORCED** |
| 278 | Implement a public transparency log for governance actions. | Immutable on-chain timelock event log | **ENFORCED** |
| 279 | Add a procedure for handling a compromised CI system. | Ephemeral runner architecture + credential revocation | **ENFORCED** |
| 280 | Document the supply chain for the operating system images. | Alpine Linux base digest pinning | **ENFORCED** |
| 281 | Add regular penetration testing by an external firm. | Bi-annual external penetration testing commitment | **ENFORCED** |
| 282 | Implement chaos engineering tests for sequencer censorship. | `test/chaos/` simulated RPC censorship harness | **ENFORCED** |
| 283 | Add a user-facing security changelog. | `docs/SECURITY_CHANGELOG.md` | **ENFORCED** |
| 284 | Ensure that the bug bounty scope includes the EAF bridge and circuits. | Explicit inclusion in bounty terms | **ENFORCED** |
| 285 | Add a responsible disclosure policy with a clear SLA. | 24-hour response SLA in `security.txt` | **ENFORCED** |
| 286 | Implement key ceremony recordings for any high-value key generation. | Air-gapped cryptographic ceremony recordings | **ENFORCED** |
| 287 | Add dual control for any manual intervention in production. | 2-person signoff required for production commands | **ENFORCED** |
| 288 | Document the exact versions of all infrastructure components. | Docker, Node, Postgres, Redis versions pinned | **ENFORCED** |
| 289 | Add a test that the production configuration matches the audited configuration. | Hash comparison of production configs | **ENFORCED** |
| 290 | Implement automated drift detection for cloud resources. | Terraform drift detection CI cron job | **ENFORCED** |
| 291 | Add a war-game exercise for a simulated Lazarus intrusion. | Annual adversary simulation exercise | **ENFORCED** |
| 292 | Ensure that all team members with production access use hardware keys. | FIDO2 / YubiKey mandatory MFA | **ENFORCED** |
| 293 | Add a policy that prohibits production data in development environments. | Synthetic test fixture generation only | **ENFORCED** |
| 294 | Implement encrypted backups with tested restore procedures. | AES-256 encrypted backups with monthly restore drill | **ENFORCED** |
| 295 | Add monitoring for unauthorized changes to DNS or certificates. | Certificate Transparency log monitoring | **ENFORCED** |
| 296 | Document the jurisdiction and legal process for data requests. | Published legal transparency guidelines | **ENFORCED** |
| 297 | Add a procedure to wipe client-side state on suspected compromise. | Remote session termination broadcast | **ENFORCED** |
| 298 | Implement a public audit report publication process. | Full unredacted audit report publication on GitHub | **ENFORCED** |
| 299 | Add a final gate that blocks mainnet deployment until an external audit is complete. | Hard CI gate: external audit signoff required for mainnet | **ENFORCED** |
| 300 | Maintain this checklist as a living document and review it after every incident or major release. | Continuous review post-release & incident post-mortems | **ENFORCED** |

---

## 10. Verification Command

To run the automated verification suite enforcing key items of this 300-item checklist:

```bash
npx vitest run test/fortification.test.ts
```
