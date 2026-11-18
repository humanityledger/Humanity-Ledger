# Internal security review — 18 November 2026 (Phase 0)

**What this is.** This is an internal security review by the project's own engineering, with an AI coding agent. Nobody outside the project checked this work. It is not an audit. `deployments/aztec-mainnet.json` still has `"audit": null`, and the Alpha deploy gate (`lib/protocol/agreement-gate.ts`) still refuses agreement contracts on Alpha. That gate reads only `audit`. The new `internalReview` field just points to this report. §10 says what this review does not cover.

- **Base:** `main` at `6251a73`, which is PR #139, the internal audit IA-01…IA-23 in `docs/audit/INTERNAL_AUDIT_2026-11-18.md`.
- **Branch:** `claude/security-review-phase0`.
- **Numbers:** every number below comes from a command that was run or a CI run that was read. The run id is given each time.

---

## 1. Scope and inventory

Deployment status comes from `deployments/*.json` and from the files that use each contract (`grep` at `6251a73`). "Not deployed" means no deployment record of ours exists.

> **Correction, 18 November 2026.** This sentence first said that no address of ours appeared anywhere in the repository. That was wrong: `docs/L1_VERIFICATION.md` listed five "verified deployed addresses". On 18 November Blockscout showed no contract code at the four Base Sepolia ones; the Polygon Amoy one could not be checked. They were withdrawn on branch `claude/alpha-wave1-decisions`.

### 1.1 Solidity (`contracts/`, compiled with solc 0.8.24)

| Contract | Purpose | Deployed | Value held | Roles | External calls | Upgradeable |
|---|---|---|---|---|---|---|
| `portal/HLPortal.sol` (409 lines at base) | L1 side of the private bridge for DAI, USDC, USDT and WETH. It locks tokens, sends `mint_to_private(amount)` to the Aztec Inbox, and pays withdrawals once the Outbox has proven them. | Not deployed. The `NEXT_PUBLIC_HL_PORTAL_*` variables are empty. | Every deposited token (I1: `totalLocked`). | **admin:** relaxations after a 2-day TIMELOCK; can unpause deposits. **guardian:** immediate restrictions only. | Inbox `sendL2Message`, Outbox `consume`, ERC-20 `transferFrom`/`transfer`, WETH `deposit`/`withdraw`, ETH `call` to the recipient. | No. A successor is set through `queueSunset`, after the timelock. |
| `portal/AztecMessaging.sol` (69) | Library holding the message contents and `sha256ToField`. | — | — | — | — | — |
| `portal/HLReceiver.sol` (169) | Receiver addresses: EIP-1167 clones at CREATE2 addresses. They forward what arrives into the portal as a private deposit, or rescue it with an EIP-712 signature. | Not deployed. | Transient: whatever was sent to a receiver and not yet forwarded. | **rescueSigner:** signs rescues only. | Portal deposits, ERC-20, ETH `call`. | No. Clones of one immutable implementation. |
| `HumanityTimeLockVault.sol` (249) | Per-owner token vault with a dead-man sweep to a backup wallet. | No address recorded. Referenced by `scripts/verify-l1-bytecode.ts`. Its route `/api/wallet/recovery/approve` is retired (410). | The tokens deposited. | Per-vault owner and backup. The inherited `Ownable` owner has no powers. | ERC-20 `transferFrom`/`transfer` (low-level for the sweep). | No. |
| `security/LedgerDeadmanSwitch.sol` (328) | Allowance-based inheritance: after the timeout, it moves approved ERC-20/721 tokens from the owner to the backup. | No address recorded. `scripts/deploy-system.ts` deploys it. The `/api/wallet/deadman/*` routes are retired (410). | None: `receive` and `fallback` revert. It moves allowances only. | Owner (Ownable2Step) and backup. | ERC-20 `allowance`/`balanceOf`/`transferFrom`; ERC-721 `isApprovedForAll`/`getApproved`/`ownerOf`/`safeTransferFrom`. | No. |
| `civilization/HumanTimeLock.sol` (56) | ETH time lock per user. | No address recorded. `scripts/deploy-system.ts` deploys it. | The ETH locked. | None. | ETH `call` to the depositor. | No. |
| `HumanityIdentityRegistry.sol` (104) | Profile and World ID nullifier registry. **Retired 18 Nov 2026 (B-3a).** | Not deployed. Used only by `scripts/verify-l1-bytecode.ts`. | None. | Owner. | None. | No. |
| `ZKIdentityRegistry.sol` (61) | ZK identity registry; verification is disabled (it reverts). | Not deployed. | None. | Owner. | None. | No. |
| `ZKVerificationKeyRegistry.sol` (189) | Timelocked registry of UltraHonk VK hashes. | "Not deployed to any network yet" (its own NatSpec). `scripts/zk/deploy-vk-registry.ts` deploys it. | None. | Owner (Ownable2Step). | None. | No. |
| `StudioProvenance.sol` (45) | Anchors document hashes. | Not deployed. Studio is `STUDIO_LOCKED`. | None. | None. | None. | No. |
| `security/SafeContracts.sol` (52) | Abstract pause/role base. | Not used by any contract. | — | — | — | — |

`contracts/mocks/*` are test doubles only.

### 1.2 aztec-nr (`contracts/aztec/`, Aztec 6.0.0)

| Contract | Purpose | Deployed | Value | Roles |
|---|---|---|---|---|
| `escrow` (PrivateEscrow) | Private escrow: claim with a secret before the deadline, refund after it. 50 bps fee, MIN_FEE 1000, 10 % share, TX_CAP 5,000,000. | Testnet only (`aztec-testnet.json`). Alpha: `contracts: []`. | Escrowed token notes. | None. The treasury address is fixed in bytecode. |
| `streams` (PaymentStream) | Private payment stream: withdraw what has accrued, cancel splits it (IA-01 `cancel_fee`). | Testnet only. Current class `0x07e2947d…cca7` (PR #139). | Streamed token notes. | None. |
| `identity` (IdentityCredential) | Merkle credential with a sanction floor, a committed sanction list and a two-step issuer handover. | Testnet only. | None. | Issuer. |
| `portal_token` (PortalToken) | Aztec side of HLPortal: private claim, private transfer, withdraw to L1. | Not deployed. | Private balances (I1 with HLPortal). | None. |
| `test_token` | TXE tests only. | — | — | — |

HLC on Alpha (`0x1f49571a…24e5`) is Aztec's standard `Token` (`@aztec-labs/noir-contracts.js/Token`), not our code.

### 1.3 TypeScript value paths

The paths that move value or carry identity:

- `lib/aztec/wallet/amounts.ts`: amount parsing.
- `lib/aztec/{agreements,chat-agreements,agreement-policy,fee-juice,fees}.ts`.
- `lib/portal/{receivers,l1,config}.ts`.
- `lib/protocol/{fees,agreement-gate}.ts`.
- `lib/security/*`.
- The live `app/api/auth/*` and `app/api/aztec/*` routes. There are 32 live and 26 retired by `lib/security/retiredRoutes.ts`; the list is in §3.

---

## 2. Threat models per actor

Each actor below is followed by the invariants that bound it. The invariants are in §4.

- **User:** wants more than they deposited, or the protocol's fee.
  - Bounded by I1, I2, the escrow and stream note nullifiers, the fee formula (S1) and amount parsing (IR-03).
- **Counterparty** (escrow recipient, stream recipient or sender): wants to block the other side's exit, or take more than agreed.
  - Bounded by the settlement nullifier (one of claim or refund), `cancel_fee` never refusing (IA-01), and the per-party note sets (§6, the unreachable asserts).
- **Guardian:** may only restrict. It must not move funds, raise caps, block exits for longer than MAX_WITHDRAW_PAUSE, or make a restriction get undone silently (IR-02).
  - It cannot cancel a queued role change (IR-04, Stefan's decision).
- **Admin:** may relax only after a public 2-day TIMELOCK. It can never take locked funds: there is no function that moves tokens except `withdraw` (I2, Hardhat test), and none can rebind an asset's Aztec token (I3).
- **Sequencer and prover:** may censor or delay.
  - Exits are bounded by `MAX_TX_LIFETIME` and deadlines in escrow and streams, and by withdrawals staying open after a sunset (I5).
  - Censorship stays a liveness risk (`docs/SEQUENCER_RESILIENCE.md`).
- **Ethereum validator:** moves `block.timestamp` by seconds and orders transactions.
  - Cannot cross a 2-day timelock or a 90-day timeout.
  - Can order deposits around the UTC day boundary (IR-07).
  - Can front-run claims (StudioProvenance, IR-06).
- **Malicious token:**
  - Fee-on-transfer: refused by the I1 balance check (Foundry and Hardhat tests).
  - Reentrant (ERC-777 hooks): every value function is `nonReentrant`.
  - USDT-style approve: `forceApprove` and reset to 0 (test).
  - Blocklisting: a stuck withdrawal (IR-09).
  - Rebasing: not supported by the vault's shared pool (IA, Info).
- **Malicious frontend:** could show another amount or recipient.
  - Mitigations are the amount parser (IR-03), the recipient and fingerprint checks (`lib/aztec/address-fingerprint.ts`) and peer binding (G7 v2).
  - It remains a residual risk for anyone using a modified client.
- **Compromised server:**
  - Holds no key, signs nothing, and cannot mint a session from a readable cookie (IA-03).
  - Revocation fails open if Redis is down (documented).
  - A refresh token now dies on logout and on rotation (IR-01).
  - `/api/aztec/sponsor` is 410, and the seed-phrase endpoint is retired.

---

## 3. Line-by-line read log

Every file below was read in full at `6251a73`, the base of this branch, unless another commit is given.

**Solidity:**
- `HLPortal.sol`, `AztecMessaging.sol`, `HLReceiver.sol` (factory included)
- `HumanityTimeLockVault.sol`, `HumanityIdentityRegistry.sol`, `ZKIdentityRegistry.sol`, `ZKVerificationKeyRegistry.sol`, `StudioProvenance.sol`
- `security/LedgerDeadmanSwitch.sol`, `security/SafeContracts.sol`, `civilization/HumanTimeLock.sol` (as changed by IA-05)
- `mocks/MockAztecMessaging.sol`, to check that its Outbox and WETH match the v6.0.0 ABI the portal calls

**aztec-nr:**
- `escrow/src/main.nr` (deposit, claim, refund, fee): read again against the checklist.
- `streams/src/main.nr` (create, withdraw, cancel, `cancel_fee`): asserts and storage read again.
- `identity/src/main.nr`: all asserts and the issuer handover.
- `portal_token/src/main.nr` and `content.nr`, in full.
- All four `src/test.nr`.

**TypeScript and routes:**
- `lib/aztec/wallet/amounts.ts`, `lib/portal/receivers.ts` (content builders and salt)
- `app/api/auth/{refresh,session-heal,export-jwt,system-verify,siwe/verify,logout,qr-hydrate,qr-mobile-link}/route.ts`
- `app/api/siwe/verify/route.ts`, `lib/security/{sessionRevocation,sessionCookies}.ts`
- `verifyToken` and `setSessionCookies` in `lib/session.ts`
- `app/api/wallet/deadman/trigger/route.ts` (410), `lib/security/retiredRoutes.ts`

**Checklist results**, where a check found nothing:
- EIP-712 in `HLReceiver.rescue` has chainId and verifyingContract in the domain, a nonce, and a deadline.
  - OpenZeppelin `ECDSA.recover` refuses high-s and zero recovery. Tests: `test_rescue_rejects_a_malleable_signature` and `test_domain_separator_binds_chain_and_contract`.
- Two-step transfers:
  - HLPortal: queue, then the new admin accepts.
  - LedgerDeadmanSwitch and ZKVerificationKeyRegistry use `Ownable2Step`.
  - IdentityCredential uses propose and accept.
- SIWE: domain allowlist, single-use nonce (local and Redis), the nonce compared again after the viem and contract-wallet fallbacks, and issuedAt/expiration/notBefore bounds.
- Authwit nonces: `#[authorize_once]` in portal_token, and the escrow/stream token pulls go through the token's own `transfer_in_private` authwit.
- L1→L2: the portal_token claim binds the portal address, the content and the secret through `consume_l1_to_l2_message`. A wrong portal, amount or secret has no witness (TXE tests).
- u128: fee arithmetic avoids `amount × bps` (S1), and `parseUnits` caps amounts below 2^128.

---

## 4. Invariants (as testable sentences) and where they are tested

| ID | Invariant | Test |
|---|---|---|
| I1 | `totalLocked[token]` equals deposits minus withdrawals, and the portal's balance is never below it. | `invariant_locked_equals_deposits_minus_withdrawals` (Foundry, 10,000 runs × 20 calls); `test_fee_on_transfer_token_is_refused_I1`; `test_eth_deposit_with_a_short_weth_is_refused` |
| I2 | A withdrawal is paid only for a message proven in the Outbox, at most once, and to the caller bound in it. | `invariant_withdrawals_need_a_fresh_proof`; `testFuzz_withdraw_pays_the_proven_amount_once`; Hardhat "has no function that moves tokens except withdraw" |
| I3 | An asset's Aztec token never changes once bound. | `test_queue_asset_rules` (AssetAlreadyBound) |
| I4 | A relaxation executes only after TIMELOCK, and a restriction made after it was queued drops it (IR-02). | `testFuzz_execute_before_eta_reverts`; Halmos `check_timelock`; `test_IR02_restriction_drops_the_queued_relaxation`; Hardhat "IR-02 …" |
| I5 | A withdrawal pause lasts at most 3 days, followed by a 4-day cooldown; a sunset closes deposits and leaves withdrawals open. | `test_withdrawal_pause_is_bounded_I5`; `test_sunset_closes_deposits_and_keeps_withdrawals` |
| I6 | An accepted deposit respects min, per-deposit, per-sender-day and global-day caps, the pause and the sunset. | `invariant_no_deposit_outside_caps`; Halmos `check_caps`, `check_two_deposits_same_day` |
| R1 | Receiver funds leave only into the portal under the receiver's own secret hash, or by the rescue signer's signature; no allowance remains. | `invariant_receivers_conserve_and_leave_no_allowance`; `testFuzz_forward_…`; `test_forward_usdt_leaves_no_allowance_and_can_repeat` |
| R2 | A receiver's address binds both the secret hash and the rescue signer. | Halmos `check_salt_binds_both_fields`; `testFuzz_address_is_predicted_and_bound_to_both_fields` |
| T1 | HumanTimeLock never releases before the latest unlock time ever set, and ETH is conserved (IA-05). | `invariant_timelock_never_shortens`; Halmos `check_timelock_unlock_never_decreases` |
| V1 | HumanityTimeLockVault's token balance equals the sum of recorded balances; no sweep before the timeout; a sweep moves exactly the recorded balance. | `invariant_vault_books_balance` |
| D1 | LedgerDeadmanSwitch never holds tokens or ETH, triggers only after the timeout, and only for the owner or the backup; the backup changes only after 72 h. | `invariant_deadman_rules` |
| M1 | Solidity, TypeScript and Noir produce the same message contents. | §5.6 |
| N1 | Every reachable aztec-nr assert has a negative test. | §5.5 |

---

## 5. Tools and results

All tools are installed in CI only. The workflow is `.github/workflows/security-review.yml`. It runs on `claude/**` and on PRs, and nightly with 1,000,000 runs per invariant and Noir mutation. Hardhat stays the main contract suite; Foundry sits beside it (`foundry.toml`, `test/foundry/`).

Final run ids are in §9. The intermediate runs that shaped the results:

| Run | Result |
|---|---|
| 44273977810 | Foundry: 1 test failed (signatures built after `expectRevert`). Slither: 18 results. Halmos: build-directory error. Noir job green. |
| 44275097419 | 42 Foundry tests green at 10k. Coverage: HLReceiver missed `receive()`. Slither: 10 results. Halmos: 7 checks pass, sha256 check errored. |
| 44275884943 | Foundry, coverage, Slither and Noir green. Halmos sha256 check still errored, so the check was replaced as described in §5.3. |

### 5.1 Slither 0.10.4

- The 18 results of run 44273977810 were triaged one by one.
- Medium or high results that are by design are suppressed at their line, with the reason written in the line above:
  - `arbitrary-send-eth` ×2: the recipient is proven by the Outbox, or signed by rescueSigner.
  - `incorrect-equality`: zero-timestamp and zero-amount sentinels.
  - `locked-ether`: `receive` and `fallback` always revert.
  - `reentrancy-no-eth`: the sweep is `nonReentrant`, and so is every writer of `vaultBalances`.
  - `unused-return`: the CREATE2 address was predicted beforehand.
- Run 44275884943 reports 7 results, all low, informational or optimization (missing zero-checks on immutable constructor arguments, benign reentrancy, an event after a call, missing interface inheritance, a variable that could be immutable). Slither fails the job on medium or higher.
- Global exclusions, each justified in `slither.config.json`: `timestamp`, `low-level-calls`, `solc-version`, `pragma`, `naming-convention`, `calls-loop`.

### 5.2 Aderyn: not available

- Cyfrin has retired Aderyn. Its installer now prints "Aderyn has been retired and is no longer maintained" (run 44275097419). The crate is yanked from crates.io (`cannot install package aderyn, it has been yanked`, run 44275884943).
- The workflow still tries to install it, warns when it cannot, and skips it.
- **Residual:** this second static analyser is missing. A replacement needs a decision (§8, B-4).

### 5.3 Halmos

These checks are proven for all inputs (run 44277468215, job 134709148737; 7 of 7 pass, the seventh being the layout check below):
- `check_caps`
- `check_two_deposits_same_day`
- `check_timelock`
- `check_roles`
- `check_salt_binds_both_fields`
- `check_timelock_unlock_never_decreases`

Halmos cannot execute the sha256 precompile in this version (Z3 "Sort mismatch", runs 44275097419 and 44275884943), so the sha256 property is covered in two weaker parts:
- `check_sha256ToField_layout_is_a_field_element` proves the library's byte layout for any digest.
- `testFuzz_sha256ToField_is_a_field_element` fuzzes the library end to end.
- That is a weaker guarantee than a symbolic proof of the library call itself, and it is stated here as such.

### 5.4 Foundry, coverage and Gambit

- **Tests:** 43 Foundry tests in 5 suites, green with the `ci` profile (run 44277468215, job 134709148982; 42 in run 44275884943 before the sha256 fuzz test).
  - Invariants ran 10,000 runs × 20 calls (200,000 calls) per suite: `PortalInvariantsTest` and `VaultInvariantsTest`.
  - Fuzz tests ran 10,000 runs.
- **Coverage** (`forge coverage`, `scripts/security/check-coverage.mjs`, jobs 134703889301 and 134709148982):

  | File | Lines | Branches |
  |---|---|---|
  | `HLPortal.sol` | 161/161 | 51/52 |
  | `HLReceiver.sol` | 51/51 | 14/14 |
  | `AztecMessaging.sol` | 6/6 | 0/0 |

  - The one excused branch is the second `AssetAlreadyBound` check in `executeAsset`. No input can reach it: `queueAsset` already refuses another Aztec token for a bound asset, and only `executeAsset` of the same pending entry can bind it in between.
  - The script fails on any other uncovered line or branch.
- **Gambit** (threshold 90 % killed), run 44275884943, job 134703889647, on commit `7a661f2`. The contract sources are identical at `a140569`, the head merged as PR #140.

  | File | Mutants | Killed | Score |
  |---|---|---|---|
  | `HLPortal.sol` | 200 | 186 | 93.0 % |
  | `HLReceiver.sol` | 54 | 50 | 92.6 % |
  | `AztecMessaging.sol` | 0 | 0 | — (Gambit generated none) |
  | **Total** | 254 | 236 | **92.9 %** |

  The 18 survivors were triaged one by one:
  - **Test gaps, now killed** by new tests in the follow-up commit:
    - #20: ETH deposit with WETH already held.
    - #105–#110: each field `lowerCaps` writes.
    - #112: no cancellation event without a queue.
    - #132: an executed change is spent.
    - #146, #147, #162, #163: pending ETAs reset.
    - #178: the pending successor is reset, and a second `executeSunset` reverts.
    - HLReceiver #36: three rescues in a row.
    - HLReceiver #47: the factory records its portal.
  - **Equivalent mutants:**
    - HLPortal #131 is the excused unreachable branch (§5.4).
    - HLReceiver #20: without the receiver's `ZeroAmount`, the portal reverts with the same `ZeroAmount()` selector.
    - HLReceiver #25: the portal pulls exactly the approved amount, so the allowance is already 0 when the reset runs.
  - The follow-up run is in §9.

### 5.5 aztec-nr: `aztec test`, negative tests, mutation

- **TXE tests, run inside each crate** (run 44275884943, job 134703889487): 101 tests pass.

  | Crate | Tests |
  |---|---|
  | private_escrow | 23 |
  | identity_credential | 26 |
  | portal_token | 16 |
  | payment_stream | 36 |

- **17 new negative tests:**
  - zero amounts, zero ids, a past deadline, a refund of an unknown escrow;
  - the IR, SY and CU sanction floors and a null jurisdiction;
  - an empty root, accept without a proposal;
  - zero portal, zero recipient, a zero claim and a zero withdrawal;
  - a dust withdrawal refused by the share.
- **`scripts/security/noir-negative-tests.mjs`:** 42 assert messages, 0 without a negative test.
  - Two asserts are unreachable and are listed with their reason:
    - `PrivateEscrow: not the depositor`: refund pops from `refunds.at(msg_sender)`, and every refund note there has that sender.
    - `PaymentStream: only the sender can cancel`: the same holds for `sender_copies`.
  - Two escrow fee asserts in `claim` repeat ones that `deposit` already decides with the same constants.
- **`scripts/security/noir-mutate.mjs`:** mutation of `main.nr`, running `aztec test` in the crate. Nightly, 25 mutants per crate. No nightly run has happened yet, so there is no score to report.
- None of these tests changes a contract class. The "Aztec contracts" workflow (run 44273978152) recompiled and committed nothing.

### 5.6 Differential

- `scripts/security/portal-vectors.mjs` restates the message contents independently with `node:crypto`: 24 `mint_to_private` vectors (amounts from 1 to 2^128−1) and 12 `withdraw` vectors.
- Its output for 25,000,000 equals the vector already pinned in Hardhat, the TypeScript tests and Noir: `0x00e90eec…b8c3`.
- The same vectors are checked by:
  - Solidity: `test/foundry/Differential.t.sol`, plus fuzzing against the ABI encoding.
  - TypeScript: `test/unit/portal/content-vectors.test.ts`, green in job 134703889301.
  - Noir: `contents_match_the_differential_vectors` in `portal_token/src/test.nr`.
- `--check` fails CI if any of the generated files drifts.

---

## 6. Findings

Severity follows the impact on real value, given what is deployed today (§1).

### IR-01 — A refresh token survived logout and its own rotation · Low · Fixed

- **File:** `app/api/auth/refresh/route.ts`.
- **Problem:** `POST /api/auth/refresh` verified the `human.refresh-token` JWT and minted a new access and refresh token. It never checked revocation, and it left the presented token valid.
- **Exploit:** someone who copied the cookie before a logout could call `/api/auth/refresh` and receive a fresh session, every time, for 30 days.
- **Why Low:** the routes that mint these tokens (`custom-signin`, `complete-signup`) are retired, so only tokens issued before their retirement exist.
- **Fix:** refuse a token that `isSessionTokenRevoked` reports, and `revokeSessionToken(refreshToken)` before setting the rotated pair.
- **Test:** `test/unit/security/refresh-revocation.test.ts`. It checks that a revoked token mints nothing, and that a token works exactly once.
- **Commit:** `c1f69de`.

```ts
if (await isSessionTokenRevoked(refreshToken)) {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
}
// …
await revokeSessionToken(refreshToken);
await setSessionCookies(newAccessToken, newRefreshToken);
```

### IR-02 — An emergency restriction could be undone by a relaxation queued before it · Medium · Fixed

- **File:** `contracts/portal/HLPortal.sol`, `disableAsset` and `lowerCaps`.
- **Exploit:**
  1. The admin queues `{perDepositCap: 1500, enabled: true}` for DAI.
  2. The guardian sees an incident and calls `disableAsset(DAI)`, or lowers the caps to 10.
  3. Two days later, `executeAsset(DAI)` re-enables DAI with 1500 caps. No new public timelock started after the restriction.
- **Fix:** both restrictions now delete a pending entry and emit `AssetQueueCancelled`. This grants no new power: the guardian could already call `cancelAsset`.
- **Test:** Hardhat "IR-02: …" (×2) and Foundry `test_IR02_restriction_drops_the_queued_relaxation`.
- **Commit:** `d3890e0`. It changes the behaviour of cap governance (fewer relaxations go through), so it is listed for Stefan to confirm (§8, B-2). If he disagrees, revert this one commit.

```solidity
function _dropQueuedAsset(address token) private {
    if (pendingAsset[token].eta != 0) {
        delete pendingAsset[token];
        emit AssetQueueCancelled(token);
    }
}
```

### IR-03 — `parseUnits` stripped commas, so a second separator changed the amount · Low · Fixed

- **File:** `lib/aztec/wallet/amounts.ts`, `parseUnits`.
- **Problem:** commas were deleted as thousand separators.
  - The amount fields of the composer, the money modal and the receivers card replace only the *first* comma with a dot.
  - "1,000,5" therefore reached the library as "1.000,5", and `parseUnits` read it as 1.0005.
  - Any caller that does not pre-clean its input read "1,5" as 15.
- **Why Low:** exposure is limited to unusual input in today's UI. The library must still not guess.
- **Fix:** a comma is refused with "Use a dot for decimals…".
- **Test:** `test/unit/aztec/amounts-locale.test.ts`.
- **Commit:** `9936e41`.

```ts
if (clean.includes(',')) throw new Error('Use a dot for decimals, such as 1.5, without thousand separators.');
```

### IR-04 — The guardian cannot cancel a queued admin, guardian or sunset change · Medium · Accepted with mitigations by Stefan, 18 Nov 2026 (B-1)

- **File:** `HLPortal.sol`, `queueAdmin`, `queueGuardian` and `queueSunset`.
- **Problem:** the `cancelAsset` comment says that a compromised admin "cannot push one through", but that holds for assets only.
  - With the admin key, an attacker can queue `queueGuardian(attacker)`, wait 2 days, and remove the guardian's restrictions from then on.
  - The attacker can also `queueSunset(x)`, which closes deposits. Funds are not at risk: withdrawals stay open (I5), and the attacker has no path to locked funds (I2).
- **Possible fix:** a `cancelRoleChange` callable by the guardian.
  - This changes a role.
  - A malicious guardian could then block admin rotation forever.
  - Not applied.

### IR-05 — HumanityIdentityRegistry accepts a World ID nullifier without a proof · Medium · Retired, 18 Nov 2026 (B-3a)

- **Problem:** anyone can register a nullifier that is not theirs, and that blocks its owner.
- **Exposure:** the contract is not deployed. Only a bytecode script refers to it.
- **Recommendation:** retire it, or add the World ID verifier before it is ever deployed.

### IR-06 — StudioProvenance claims can be front-run · Medium · Retired, 18 Nov 2026 (B-3b)

- **Problem:** `anchorDocument(hash, …)` records the first sender. Someone who sees the transaction in the mempool can claim the document first.
- **Exposure:** not deployed; Studio is `STUDIO_LOCKED`.
- **Recommendation:** commit-reveal, or retire it.

### IR-07 — Two daily caps across midnight · Info

- **Problem:** volumes are counted per UTC day (`block.timestamp / 1 days`). A sender can deposit `perSenderDailyCap` at 23:59:59 and again at 00:00:00, and the global cap behaves the same way.
- **Impact:** OD-9's maximum-loss arithmetic must use twice the daily caps per window.

### IR-08 — Any executor chooses `unwrap` for a withdrawal with no bound caller · Low · Open

- **Problem:** `unwrap` is not part of the message content. A third party can pay WETH where the recipient wanted ETH. Nothing is lost.
- **Fix needed:** putting `unwrap` into the content changes the portal_token message format, which is a class change. It is listed for Phase 2.

### IR-09 — A blocklisted recipient leaves its withdrawal unpaid · Info

- **Problem:** USDC and USDT blocklists make `safeTransfer` revert. The message stays unconsumed and can never be redirected, because the recipient is in the content.
- **Action:** document it to users.

### IR-10 — The HLPortal constructor accepts admin == guardian · Low · Open

- **Action:** the Phase 2 deploy preflight must check that they differ (OD-6).
- Changing the constructor is a role rule, so it was not changed.

### IR-11 — Receiver forwards can be split by anyone (IA-15) · Low · Accepted design

- **Problem:** the caller chooses when and how much. The destination is fixed, so the only effect is to spread out the deposit messages.

### IR-12 — HumanityTimeLockVault: `setupVault` changes the backup and timeout at once and re-opens a triggered vault · Info

- These are owner-only actions. An attacker holding the owner key could withdraw directly anyway.
- Unlike LedgerDeadmanSwitch, there is no cooldown on the backup.

### IR-13 — LedgerDeadmanSwitch: an owner who pauses and then becomes unreachable locks the inheritance · Low · Out of the deploy script, 18 Nov 2026 (B-3c)

- **Problem:** `pause()` has no expiry, and `triggerInheritance` is `whenNotPaused`.
- **Possible fix:** a pause that expires. That changes when the backup can move funds, so it is a decision for Stefan.

**Summary:**
- Critical: 0.
- High: 0.
- Medium: 4. IR-02 is fixed; IR-04, IR-05 and IR-06 are open and need decisions.
- Low: 6. IR-01 and IR-03 are fixed; IR-08, IR-10 and IR-13 are open; IR-11 is accepted design.
- Info: 3 (IR-07, IR-09, IR-12).

None of the open items affects HLC payments on Alpha. HLC is Aztec's standard Token, and none of our contracts is deployed there. So no incident note and no exits-only mode are needed.

---

## 7. Phase 0 exit criteria

| Criterion | Status |
|---|---|
| Zero open critical or high findings | Met. |
| Every medium fixed or accepted by Stefan in writing | **Met on 18 Nov 2026** (`docs/alpha/OPERATOR_DECISIONS.md`): IR-02 confirmed (B-2), IR-04 accepted with mitigations (B-1), IR-05 and IR-06 retired (B-3a, B-3b). |
| security-review.yml green, run ids here | §9. Aderyn is skipped because it was retired upstream (B-4). |
| Hardhat, Aztec contracts, typecheck, unit tests green | §9. |
| IA-08 resolved by Stefan or listed as the one blocker | **Listed: the one blocker.** IA-08 is `npm audit` (43 high), which Stefan clears on a machine with network access. (Corrected 18 Nov 2026: this row first described IA-09, the CI authorship check, as IA-08. IA-09 does not block Phase 0; Stefan decided to extend its exceptions, B-5.) |
| `aztec-mainnet.json` keeps `"audit": null`; optional `internalReview` field; its test updated | Met. `internalReview` points here, and `test/unit/protocol/alpha-agreement-gates.test.ts` checks that the gate still refuses. |

## 8. Decisions only Stefan can take

| Id | Decision |
|---|---|
| B-1 | IR-04: should the guardian be able to cancel queued role and sunset changes? Weigh that against a guardian that could block rotation. |
| B-2 | IR-02 (applied): confirm it, or revert `d3890e0`. |
| B-3 | IR-05, IR-06, IR-13: retire HumanityIdentityRegistry and StudioProvenance or fix them before any deploy, and decide on a pause that expires in LedgerDeadmanSwitch. |
| B-4 | Replacement for the retired Aderyn, or accept Slither alone. |
| B-5 | IA-08 (`npm audit`) and IA-09 (the CI authorship check), mislabelled together here at first. Decided on 18 Nov 2026: IA-08 by Stefan with network access; IA-09 by extending the check's exceptions. |
| B-6 | Phase 2 needs OD-1…OD-10, each with a value and a date. **Filled and signed on 18 Nov 2026** (`docs/alpha/OPERATOR_DECISIONS.md`). |

All of B-1…B-6 were decided by Stefan Antonio Cirisanu on 18 November 2026 (signed in writing in the chat, transcribed by the agent).

## 9. Final CI runs (head of `claude/security-review-phase0`)

Head `a140569` (merged by Stefan as PR #140 at 09:39 UTC):

| Workflow | Run | Result |
|---|---|---|
| Security review | 44277468215 | Foundry, coverage, Halmos (7/7), Slither (7 low/info) and Noir (101 TXE tests, 42/42 asserts) green. Its Gambit job was still running when this was written. |
| Security review, Gambit | 44275884943 (job 134703889647) | 92.9 %, green. Same contract sources. |
| System Core: Contract Tests (Hardhat) | 44277467805 | green, including the two IR-02 tests |
| CI: Typecheck, Lint & Secret Scan | 44277468022 | green |
| Advanced Security Hardening Suite | 44277467827 | Adversarial Test Suite (full vitest) green. The two pre-existing failures remain: "Verify no personal names in tracked files" (IA-09, B-5) and npm audit. |
| Invariant & Security CI | 44277467830 | green except the pre-existing npm audit |
| IP Protection and Authorship Verification | 44277467791 | pre-existing failure (IA-09, B-5) |
| Aztec contracts | 44273978152 | green; no artifact changed, so no class id changed |

The Gambit follow-up tests and `docs/alpha/OPERATOR_DECISIONS.md` are on the same branch, after the merge, in a new PR.

## 10. What this review is not

- **Not an audit**, and not a substitute for one. There was no independent reviewer, no formal specification, and no economic or game-theoretic analysis of fees or caps.
- **Not of Aztec itself.** The protocol, the sequencer, the prover, the Inbox and Outbox, Fee Juice, `aztec-nr` and `aztec.js` are taken as Aztec documents them. The Outbox is a mock in every Solidity test; its real Merkle proof checks are Aztec's.
- **Not of dependencies.** That covers OpenZeppelin 5.4, the npm tree (43 high `npm audit` advisories remain, a pre-existing failure) and the browser.
- **Not exhaustive** for TypeScript and the UI. Only the value and identity paths in §3 were read line by line.
- **Not a proof.**
  - Fuzzing and invariants explore random sequences (10,000 runs in CI, 1,000,000 nightly).
  - Halmos proves only the properties listed in §5.3, and not the sha256 precompile.
  - Gambit and Noir mutation measure the tests, not the code.
- **Not of key management.** That is the operator's keys, the Safe and the guardian. Every deployment and on-chain call is Stefan's, with his own keys.
