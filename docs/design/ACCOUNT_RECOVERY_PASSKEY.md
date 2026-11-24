# Account recovery and passkeys: decision (24 November 2026)

Alignment items 4 and 5. Decided by Claude on the operator's delegation; to be confirmed by Stefan
before any contract work starts.

## What exists

`lib/aztec/wallet/passkey.ts`. The account root is the EIP-712 signature of the person's Ethereum
wallet; every Aztec key derives from it. A passkey with the PRF extension wraps that root
(AES-256-GCM); the wrapped record stays on the device and, as ciphertext, in a server backup.
Either the Ethereum wallet or any enrolled passkey opens the same account. Nothing on chain changes.

## Options considered

| Option | What it gives | What it costs | Decision |
|---|---|---|---|
| A. Keep the wrapping model | Recovery without the Ethereum wallet, today, with no contract | Losing both the wallet and every passkey loses the account | **Keep.** |
| B. secp256r1 account contract that verifies WebAuthn | The passkey is the account key; no Ethereum wallet at all | WebAuthn signs `authenticatorData ‖ SHA-256(clientDataJSON)`, not the message: the contract must parse `clientDataJSON` in Noir. A new account contract with custody of funds needs an external audit (G8) | **After G8.** |
| C. Guardian recovery in the account contract | Friends or devices can restore access | The Schnorr account in use keeps its signing key in an immutable note, so rotation means a new account contract; Aztec addresses commit to the privacy keys, so those cannot rotate without a new address | **After G8**, together with B, as one audited account contract. |

## Consequences

- No new contract in this cycle. The app keeps saying plainly that losing both the wallet and all
  passkeys loses the account (`passkey.ts`, Security model page).
- When G8 is scheduled, the audit scope (`docs/audit/EXTERNAL_AUDIT_SCOPE.md`) adds one account
  contract covering B and C, verified first on the test network.

# Contact QR and the Aztec binding: decision

Alignment item R1. The contact QR opens a chat by username without showing the wallet address
(`ProfileShare.tsx`). Putting the Aztec address and the G7 proof into it would publish both to
anyone who sees the code and would exceed the size the branded QR is tested for (330 characters).
**Decision:** the QR stays minimal. The binding is proved inside the encrypted conversation
(signed v2 announcement, `lib/aztec/peer-binding.ts`), where only the two people see it, and
payments require it.

# Rollup upgrades: what the app does

Alignment item R8. When the node reports the same L1 but a different rollup version or rollup
address than the build pins, the wallet stops before any key is used and says that private
payments are paused until Ledger Chat supports the new rollup (`ROLLUP_CHANGED_MESSAGE` in
`lib/aztec/wallet/client.ts`). Nothing is migrated automatically; `docs/AZTEC_UPGRADE_MIGRATION.md`
is the runbook.
