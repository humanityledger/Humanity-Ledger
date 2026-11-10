# Humanity Ledger on Aztec: audit manifest

**Date:** 10 November 2026. **Base:** `main` at `39c56b1` plus the G2 UI, G7, payment-rail and voice consolidation changes described here.
**Status:** nothing of ours is deployed on Aztec Alpha, and the contracts have had no external review (G8).

This manifest states only what was checked in the code or in the Aztec v6.0.0 sources. Where a claim from earlier internal documents could not be confirmed, the gap is listed under "Corrections" at the end.

## 1. Versions

| Item | Value | Where it is pinned |
| --- | --- | --- |
| Aztec network release | 6.0.0 ("Tierra") | `lib/aztec/sequencer/networks.ts` (`AZTEC_NODE_VERSION`) |
| Aztec Alpha | L1 chain 1, rollup version `2070860440` | `networks.ts`; checked by `identifyNode` (`lib/aztec/fees.ts`) at every wallet start |
| L1 Fee Juice portal / token (Alpha) | `0x534361be805CA30Bdb6404eC5E6cDAFFB3E9f3b3` / `0xA27EC0006e59f245217Ff08CD52A7E8b169E62D2` | `networks.ts`; a node reporting other addresses is refused (`assertNodeFeeJuiceMatchesPins`) |
| Client SDK | `@aztec-labs/*` 6.0.0 | `package.json`. The older `@aztec/*` 6.0.0-nightly.20260828 entries are aliased to `@aztec-labs/*` 6.0.0 in `next.config.js` (finding AZ-23) |
| SDK source the client was checked against | aztec-packages tag `v6.0.0` → `labs` submodule aztec-node `1b6de149` | — |
| Contracts | aztec-nr `v6.0.0` from `aztec-labs-eng/aztec-nr` | `contracts/aztec/*/Nargo.toml` |
| Bundled prover | `@aztec/bb.js` 5.3.0 (standalone UltraHonk circuits) | `package.json` |

## 2. Keys

Everything below runs in the user's browser. The server never receives a signature, a key or a seed.

```
User's Ethereum wallet
  └─ EIP-712 signature over WALLET_TYPED_DATA
     (test network)  or  WALLET_TYPED_DATA_ALPHA ("Aztec Alpha (Ethereum mainnet). Real funds.")
       ├─ HKDF-SHA256 "hl/aztec/v1/secret"   mod Fr → secretKey  ── Aztec deriveKeys → nsk_m, ivsk_m, ovsk_m, tsk_m (in the PXE)
       ├─ HKDF-SHA256 "hl/aztec/v1/salt"     mod Fr → salt
       ├─ HKDF-SHA256 "hl/aztec/v1/signing"  mod Fq → Schnorr signing key (Grumpkin)
       └─ HKDF-SHA256 "hl/aztec/v1/fee-juice-claim/<i>" mod Fr → Fee Juice claim secrets, i = 0..15
```

How this works (`lib/aztec/wallet/keys.ts`):

- **Typed data, not a personal message.** The signature is EIP-712, not EIP-191. Standard wallets sign deterministically (RFC 6979), so the same Ethereum account recovers the same Aztec account on any device.
- **One account per network.** Alpha and the test network sign different messages, so they are different accounts: a signature obtained on the test network flow cannot spend on Alpha.
- **A distinct HKDF salt.** The HKDF salt is `humanity-ledger/aztec-wallet`. Each value is 48 bytes reduced modulo the field, so the bias is below 2^-128.
- **The account.** It is an `EmbeddedWallet` "schnorr" account: `AccountManager.create` with no deployer and no immutables hash. Its address commits to the signing public key, the salt and the public keys.

**Storage at rest, a finding.** With the options used today (`EmbeddedWallet.create(nodeUrl, { nodeClientOptions })`), the wallet's own database is an unencrypted IndexedDB store. It holds the account `secretKey` and `signingKey`, and the PXE keystore holds the derived master keys. Nothing reaches our server, but the keys are not encrypted on the device.

v6.0.0 offers encrypted stores (OPFS SQLite with an encryption key, `wallets/src/embedded/store_encryption.ts`). The fix is to open both stores encrypted, with a key derived from the same signature (for example HKDF info `hl/aztec/v1/store`), or to run them `ephemeral` and resync each session. This is not done yet.

## 3. Fees on Alpha (G2)

**Code:** `lib/aztec/fee-juice.ts`, `lib/aztec/wallet/client.ts`, and the screen in `components/zk/ZkBridgePortal.tsx`.

1. **Alpha is off by default.** It requires both `NEXT_PUBLIC_AZTEC_NETWORK=alpha` and `NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true` (`assertNetworkAllowed`).
2. **Never sponsored.** No Sponsored FPC is used on Alpha. The deprecated `PrivateFeePaymentMethod` and `PublicFeePaymentMethod` are never imported.
3. **Bridging from L1.** It runs from the user's own Ethereum wallet:
   - **Address checks.** Only the pinned portal and token are used. The node's reported addresses must match the pins, and the wallet must be on chain 1.
   - **Funds checks.** The wallet must hold enough AZTEC, and enough ETH for 310,000 gas at the current fee.
   - **Approval.** The approval is for the exact amount, never unlimited.
   - **Deposit.** `depositToAztecPublic` is sent with twice its gas estimate, as aztec.js does for Inbox deposits.
   - **Claim details.** They are taken from the `DepositToAztecPublic` event, matched on recipient, amount and secret hash.
4. **New accounts.** A new account deploys by claiming in the same transaction (`FeeJuicePaymentMethodWithClaim`). Later transactions pay from the account's Fee Juice balance, and the next transaction claims any deposit that has become ready (`isL1ToL2MessageReady`).
5. **No stuck deposits.** Claim secrets are derived, never only stored. `recoverFeeJuiceClaims` finds this account's deposits in L1 logs and re-derives their secrets, so Fee Juice bridged from one device can be claimed from another. Secret indexes are never reused.
6. **Privacy, as the user is told.** Amounts, senders, recipients and private balances stay private. The L1 deposit and the account's role as fee payer are public, so an account's transactions can be linked. A private FPC would remove that link; the documented example is community code that needs review.
7. **Status.** Not yet run against Alpha. The first run is a small deposit, made by Stefan.

## 4. Proof of the peer's Aztec address (G7)

**Code:** `lib/aztec/peer-binding.ts`, `lib/aztec/wallet/client.ts` (`aztecAddressProof`), `components/chat/AgreementComposer.tsx`, `components/chat/AgreementCard.tsx`.

**Statement signed** (as an Fr, via `sha256ToField`), using `Schnorr.constructSignature` with the account's signing key:

```
hl/aztec-binding/v1 | <aztec address> | <signer XMTP inbox> | dm:<recipient XMTP inbox>
```

The version 2 announcement carries the signing public key, the salt, `PublicKeys.toString()`, both inbox IDs and the 64-byte signature. The sender checks its own proof before sending it.

**The receiver accepts it only if all of these hold:**

1. The signer inbox is the XMTP-authenticated sender, and the recipient inbox is the receiver itself, so a proof cannot be replayed to someone else.
2. `getContractInstanceFromInstantiationParams(SchnorrAccountContractArtifact, { constructorArgs: [pk.x, pk.y], salt, publicKeys })` produces exactly the announced address.
3. `Schnorr.verifySignature` passes.

**Outcomes:**

- A failing proof is rejected with a security warning and never pinned.
- A valid proof never silently replaces an address that is already pinned.
- Unsigned (version 1) announcements still pin on trust, but such addresses cannot receive payments on Alpha (`lib/payments/rails.ts`).

**Limit:** the proof shows control of the signing key, not of the address's privacy keys. A dishonest peer can announce an address made of someone else's public keys and their own signing key. Funds sent there are unusable by anyone, which only harms people who pay that peer.

## 5. Payment rails

**Code:** `lib/payments/rails.ts`, `components/zk/ZkInvoiceModal.tsx`, `components/chat/NativeCryptoSendModal.tsx`.

**Who gets paid.** Invoices are paid to their issuer (`senderAddress`), never to the payer.

**Private rail (Aztec).** Offered only when all of these hold:

- the wallet is ready;
- the issuer shared an Aztec address in this DM (verified, on Alpha);
- the token is configured;
- fees are payable.

Otherwise the reason is shown. A failed Aztec transaction changes nothing on chain.

**Public rail (Ethereum mainnet).** Always offered next to the private rail:

- **Network.** The wallet must be on chain 1; the modal asks to switch otherwise.
- **Gas reserve.** An ETH send keeps `balance ≥ amount + 1.25 × gas × maxFeePerGas`. A token send needs the token balance and that much ETH for gas.
- **One submission at a time.** A ref lock blocks double taps.
- **Paid only when mined.** The chat and the invoice are updated only after the transaction is mined and succeeded.

**Removed:**

- the demo bridge, which sent real ETH, USDC or DAI with a plain transfer to the retired Aztec Connect contract (funds sent there are not recoverable);
- the simulated invoice payment;
- an invented transaction hash (`0x${Date.now()}`).

## 6. Attachments and voice notes

**Code:** `lib/chat/remote-attachment.ts`, `lib/chat/recording.ts`, `components/chat/RemoteAttachmentBubble.tsx`.

- **Encryption.** AES-256-GCM with a key from HKDF-SHA256 of a fresh secret and salt, the derivation of XMTP RemoteAttachment.
- **What the server holds.** Ciphertext only, stored privately in R2.
- **Before anything is rendered.** The recipient checks the digest and the GCM tag, then checks the decrypted bytes' file type.
- **Recording format.** AAC/MP4 is preferred because it plays everywhere, including older iOS. The single recorder is in `LedgerChatV2.tsx`; the unused `LedgerChatVoiceNote.tsx` was removed.

## 7. Circuits and contracts

**aztec-nr contracts** (`contracts/aztec`, run in the TXE):

| Contract | TXE tests |
| --- | --- |
| PrivateEscrow | 13 |
| IdentityCredential | 20 |
| PaymentStream | 22 |

Their testnet instances and runs are recorded in `deployments/aztec-testnet.json` and `docs/AZTEC_TESTNET_DEPLOYMENTS.md`.

**Standalone Noir circuits** (`circuits/escrow`, `identity`, `streams`, with `_v2` variants and `hl_lib`): 63 Noir tests. The browser proves the three v1 circuits with UltraHonk in bb.js (`lib/zk/browser-prover.ts`, run in a Web Worker by `lib/zk/prover.worker.ts`). Their verification keys are pinned by SHA-256 in `lib/zk/vk-pins.ts`.

**Legacy simulation code.** It still exists in `lib/zk/zkMoney.ts`, `lib/zk/aztecPxe.ts` and the `ZkSettingsPanel` overview and keys tabs. It refuses to run outside `NEXT_PUBLIC_ZK_MODE=demo`. It is not on any payment path described above, but the keys tab still displays simulated keys and should be removed.

## 8. Gates

| Gate | State |
| --- | --- |
| G1 Network identity and drift | Done (`identifyNode`, weekly preflight) |
| G2 Fee Juice on Alpha | Done in code, including the screen. Not yet run on Alpha |
| G3 Real private token on Alpha | Open. Waiting for Aztec's answer on live tokens; any token must pass `checkTokenInstance` |
| G4 Bounded contract risk | Partly done (`agreement-policy.ts`: registered classes, acknowledgement, per-token caps) |
| G5 Deployments recorded | Ready. `deployments/aztec-mainnet.json` is empty |
| G6 Agreements in chat | Built. A recorded two-account session is still missing |
| G7 Proof of the peer's address | Done in code (section 4). Not yet run between two browsers |
| G8 External review | Open |

## 9. Tests

New tests added with these changes, and run here:

| Suite | Passing |
| --- | --- |
| `test/unit/aztec/fee-juice.test.ts` | 14 |
| `test/unit/aztec/peer-binding.test.ts` (9 existing, 7 G7) | 16 |
| `test/unit/payments/rails.test.ts` | 8 |
| `test/unit/chat/remote-attachment.test.ts` | 17 |
| `test/unit/chat/recording.test.ts` | 4 |

The full suite (`npm run test:run`) and `tsc --noEmit` were not run where these changes were written, because the dependencies could not be installed there. The repository has about 1,000 `it`/`test` call sites. The figure "1,427 passing" from earlier notes was not reproduced here; quote it only from a CI run.

## 10. Corrections to earlier internal documents

- **Signature standard.** Key derivation uses an EIP-712 typed-data signature, not EIP-191.
- **Derived values.** The derived values are a secret key, a salt, a signing key and Fee Juice claim secrets. The nullifier and viewing keys come from Aztec's own `deriveKeys` inside the PXE.
- **Key storage.** "Private keys never touch storage" is not true today (section 2): the keys never reach the server, but they are stored unencrypted in the browser.
- **Circuit names.** The circuits are named `escrow`, `identity` and `streams`, not `zk_escrow`, `zk_identity` and `zk_stream`.
- **Fee Juice wording.** Fee Juice is not "public on L1/L2 gas trackers" in general. What is public is the L1 deposit and which account pays each fee (section 3).
