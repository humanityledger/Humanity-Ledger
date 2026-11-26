# G8 · ZKP-SP — Scoped Personhood for messaging, calls and blocks

Status: **draft v1 (26 Nov 2026)** · Owner: Humanity Ledger · Licence: MIT OR Apache-2.0
Normative keywords: MUST, MUST NOT, SHOULD, MAY (RFC 2119).

## 0. One sentence
A person proves *"I am one registered human, not on a sanctions list, and this proof is bound to this wallet, this inbox and your challenge"* and, for each recipient or room `B`, always produces the **same blind tag** `T(A→B)`, while tags for different recipients cannot be linked.

## 1. What G8 guarantees — and what it cannot
| Property | Guaranteed by | Holds when |
|---|---|---|
| One tag per human per scope (wallet farms collapse to one identity per scope) | `T = P2_NF(s_human, scope_B)`, circuit | always |
| Unlinkability across scopes | Poseidon2 preimage resistance | `s_human` stays secret |
| Block reaches every present and future wallet of a person | `h_block = SHA256(tag‖B‖T)` | sender must present a proof to be admitted |
| No replay / proof theft | `context_binding_hash` is a public input | verifier checks wallet, inbox, nonce, freshness |
| **One `s_human` per real human** | **the leaf issuer, not the circuit** | issuer enforces uniqueness (see §4) |

G8 never claims more than its weakest anchor. A passkey or hardware key proves *a device*, not *a unique person* (one person can own many). Uniqueness comes only from a uniqueness-enforcing issuer (e-passport chip with registry de-duplication, eIDAS 2.0 PID, or an existing proof-of-personhood registry). Until one is live, Level 0 (invites + quarantine) is the effective defence against mass attacks.

## 2. Notation and domain separators
`P2_X(inputs)` = `poseidon2_hash_with_separator(inputs, DOM_SEP__X)` over BN254 `F_r`, identical to aztec-nr v6.

| Separator | u32 |
|---|---|
| `G8_HUMAN_ID` | 471829301 |
| `G8_LEAF` | 471829302 |
| `G8_NODE` | 471829303 |
| `G8_SCOPE` | 471829304 |
| `G8_NULLIFIER` | 471829305 |
| `G8_SANCTIONS` | 471829306 |

## 3. Objects
- `id = P2_HUMAN_ID([s_human])` — never revealed.
- Leaf: `leaf = P2_LEAF([id, j, t_exp, attrs, σ_salt])`, `j` = ISO-3166-1 numeric jurisdiction, `attrs` = u32 attribute bits (bit0 adult ≥18, bit1 verified entity, bit2 hardware-anchored, bit3 uniqueness-anchored). **No wallet address inside the leaf**: the same human may use unlimited wallets (fixes `IdentityCredential` coupling to `msg_sender`).
- Tree: depth 32 binary Merkle tree, `node = P2_NODE([left, right])`, root `R`. Roots stay valid for `ROOT_GRACE = 3600 s` after rotation.
- Scope: `scope_B = P2_SCOPE([domainTag_v1, targetHash_B, r_B])`; `r_B` is an optional rotating salt published by `B` (rotation = forgiving everyone).
- Tag: `T(A→B) = P2_NULLIFIER([s_human, scope_B])`.
- Context binding: `c = SHA256("hl/zksp/v1 | " ‖ walletA ‖ "|" ‖ inboxA ‖ "|" ‖ nonceB ‖ "|" ‖ t_now) mod r`.
- Block fingerprint: `h_block = SHA256("hl/zkblock/v1" ‖ B ‖ T)`; only `h_block` is ever stored.

## 4. Anchors (issuers of leaves)
| Level | Anchor | Sybil cost | Unique human? | Availability |
|---|---|---|---|---|
| 0 | Invite Capability (`hl-invite-v1`, signed by `B`, single-use, expiring) | social: someone must invite you | no | today |
| 1 | Hardware: WebAuthn device-bound credential (attestation when the platform provides it) | one physical authenticator per identity | **no** | today (Apple passkeys give no attestation; treated as Level 1 without bit3) |
| 2 | Sovereign credential: ICAO 9303 e-passport (chip read + CSCA chain + registry de-dup of a hashed document id), eIDAS 2.0 PID | one state document per identity | **yes** | needs the native app for NFC; issuer service + audit before Aztec mainnet |

A leaf carries `attrs.bit3 = 1` only from a Level 2 issuer. Recipients choose the minimum level they accept.

## 5. Admission circuit (off-chain UltraHonk, $0 gas)
Public inputs (order is normative): `R, S, scope_B, T, c, t_min, tier_mask`.
Private witness: `s_human, j, t_exp, attrs, σ_salt, index, siblings[32], sanction_list[16]`.
Constraints:
1. `leaf` as §3; Merkle path from `leaf` at `index` reproduces `R`.
2. `P2_SANCTIONS(sanction_list) == S`; `j ∉ sanction_list`; `j ∉ {408, 364, 760, 192}`; `j > 0`.
3. `t_exp ≥ t_min`.
4. `attrs & tier_mask == tier_mask`.
5. `T == P2_NULLIFIER([s_human, scope_B])`.
6. `c ≠ 0` (binds `c` into the transcript).

## 6. Verification (recipient browser or relay)
Accept a proof only if: valid UltraHonk proof for the pinned VK; `R` is the current or grace root; `S` is the current sanctions root; `scope_B` is the verifier's own scope; `c` recomputes from the sender's wallet, inbox, the verifier-issued nonce (single use, ≤ 5 min) and `|t_now − now| ≤ 120 s`; `h_block` not in the verifier's block set. Servers that relay a decision MUST compare only `h_block`, never store `T` next to a wallet.

## 7. Admission decision (all clients)
`Allowed` consent → deliver. Blocked wallet or blocked `h_block` → drop (neutral, no hint). Otherwise, if the recipient's shield is off → deliver as a request; if on → admit only with a valid Invite or a proof meeting the recipient's level; else quarantine (no attachment download, no ring, no notification).

## 8. Threats (summary)
Wallet farms → same `T`. Credential lending → leaf bound to the lender's whole identity; abuse rate-limited per `T`; `r_B` rotation and root revocation. Server correlation → servers see `h_block` only. Replay → `c`. Direct XMTP floods bypassing our servers → client-side quarantine of `Unknown` consent. Friends without credentials → Invite Capability. Quantum → Poseidon2/SHA-256 hiding of `s_human` keeps past tags unlinkable; soundness of BN254 UltraHonk is pre-quantum and will be re-based when standardised post-quantum SNARKs land.

## 9. Privacy & law
No document image or field leaves the device; issuers store only a salted de-duplication hash. Users can delete their leaf locally (GDPR art. 17); recipients store `h_block` only. Age is proven as a predicate (bit0), never as a date. Not enabled on Aztec mainnet while `deployments/aztec-mainnet.json` has `audit: null`.
