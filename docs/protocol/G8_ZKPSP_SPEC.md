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
| **One `s_human` per real human** | **the leaf issuer, not the circuit** | issuer enforces its anchor's cost (see §4) |

G8 never claims more than its weakest anchor. A passkey or hardware key proves *a device*, not *a unique person* (one person can own many). **Ledger Chat never asks for a passport, an identity card, a chip read or a native app.** Level 2 is built on Zero-Passport anchors (§4.1): vouches from existing members with a bounded quota that shrinks when the people they vouched for get blocked, and in-browser proofs that the person controls a long-lived account. These give strong economic and time cost against bots and mass sign-ups — a farm cannot make a million multi-year-old accounts or a million trusted vouchers overnight — but they are **not** state-grade biometric uniqueness, and G8 does not claim it. Until Level 2 is live, HumanGate at sign-up (§10), Level 0 invites and the privacy shield are the defence against mass attacks.

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
| 2 | Zero-Passport: ZK web of trust (bounded vouches, block-driven quota cuts) + in-browser zkTLS / ZK-Email (DKIM) proof of a long-lived account, one nullifier per account | trusted vouchers and years of account history per identity | **resistant, not guaranteed** (§4.1) | design; issuer service, pinned circuit and review before Aztec mainnet |

A leaf carries `attrs.bit3 = 1` only from a Level 2 issuer. Recipients choose the minimum level they accept.

### 4.1 Zero-Passport Level 2 (no documents, no NFC, no native app)
1. **ZK web of trust.** A member holding a live leaf may vouch for at most `q` new leaves per epoch (initial `q = 3`). A vouch is a signature over the new member's `human_id` commitment, never over a wallet or a name. When several *independent* recipients block the blind tag `T(A→B)` of a vouched member (counted by distinct `h_block` reports, which reveal no identity), the vouched leaf is not renewed at `t_exp` and the voucher's quota drops for the next epochs. Vouching for bots therefore costs the voucher their ability to vouch.
2. **Long-lived account proof (zkTLS / ZK-Email).** In the browser, the person proves with a zero-knowledge proof over a DKIM-signed email header or a TLS session transcript that they control an account older than a threshold (e.g. two years) at a large provider, revealing neither the address nor the provider account. The proof outputs a per-account nullifier `N_acct = P2(account_id_secret, DOM_SEP__NULLIFIER)` so one account yields at most one leaf. Fabricating a million multi-year-old accounts is slow and expensive; reusing one is impossible.
3. **Combination.** A Level 2 leaf needs (2) plus at least one vouch from (1), and is admitted only after a HumanGate pass at sign-up. Each anchor is replaceable without changing the circuit: they only decide who may receive a leaf.
4. **Jurisdiction field.** Zero-Passport leaves carry `j = 1` (UN M49 "World": no country attested), which satisfies the circuit's `j > 0` assertion without a circuit change. The sanctions predicate then states only that no sanctioned jurisdiction was attested; recipients that need country screening must not rely on Zero-Passport leaves for it.
5. **Honest limit.** These anchors resist bots and cheap sybils; a determined person can still hold more than one aged account or persuade more than one voucher. Level 2 stays off — never simulated — until the compiled circuit is pinned in `G8_CIRCUIT` and has been independently reviewed.

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
No document is ever requested. zkTLS / DKIM proofs run in the browser and reveal neither the email address nor the account; issuers store only per-account nullifiers. Users can delete their leaf locally (GDPR art. 17); recipients store `h_block` only. Age is proven as a predicate (bit0), never as a date. Not enabled on Aztec mainnet while `deployments/aztec-mainnet.json` has `audit: null`.

## 10. HumanGate at sign-up (`lib/g8/humanGate.ts`)
Before a passkey or wallet sign-in, `/connect` can require a human presence check (`NEXT_PUBLIC_HUMAN_GATE=1`; server enforcement with `HUMAN_GATE_REQUIRED=1`). The board is the Ledger Chat avatar mosaic (10 × 10 squares); a light follows a path fixed by a server seed (4 harmonics per axis + smooth phase kicks). The server issues an HMAC-sealed challenge (180 s, single use), checks a proof of work bound to the seed, replays the path and checks the samples (≥ 24 samples, 1.1–15 s, all events trusted, no teleports, no metronome timing, no constant speed, no straight line, reaction delay 80–480 ms, ≥ 72 % of a ≥ 1.4 s window within 1.5 squares of the light, mean distance under one square, and detrended velocity correlation ≥ 0.5 with the light over 200 ms spans, so the turns must match and not just the position). A keyboard/screen-reader mode uses four timed pulses. On success it sets an HttpOnly single-use receipt (300 s) that `/api/siwe/verify` consumes before minting the session. No third-party service is involved.

Measured on synthetic data (`test/unit/g8/g8-humangate.test.ts` and a 500-seed sweep): varied simulated humans pass 500/500; random smooth movement, zero-delay replays, screen-reading agent latency and pixel-perfect replays pass 0 %; following another board's path passes about 0.2 %. Simulated humans are not real people: thresholds must be re-checked against real pointer and touch traces before `HUMAN_GATE_REQUIRED=1` is switched on.

Honest limit: the seed must reach the browser to draw the board, so a script written specifically for this page can compute the path. HumanGate raises the cost of generic bots, screen-reading agents and mass sign-ups (work per attempt, one attempt per challenge, rate limits, one receipt per sign-in); it is not proof of personhood.
