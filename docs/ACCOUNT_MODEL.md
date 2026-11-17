# Account model, passkeys and G7

Status: 17 November 2026. Module 1 of the zk.money / Nyx parity plan. Code: `lib/aztec/wallet/keys.ts`, `lib/aztec/wallet/passkey.ts`, `lib/aztec/wallet/passkey-store.ts`, `app/api/aztec/passkeys/route.ts`, `lib/aztec/peer-binding.ts`.

## 1. Keys

| Key | Where it comes from | Where it lives | Leaves the device |
|---|---|---|---|
| Account root | EIP-712 signature by the person's Ethereum wallet over `WALLET_TYPED_DATA` (test network) or `WALLET_TYPED_DATA_ALPHA` | Memory, during the derivation only | Never |
| Account secret (aztec.js derives nsk, ivsk, ovsk, tsk from it) | HKDF(root, `hl/aztec/v1/secret`) mod Fr | PXE store, encrypted | Never |
| Salt | HKDF(root, `hl/aztec/v1/salt`) mod Fr | Memory; public in G7 proofs | As a public value |
| Schnorr signing key (account contract) | HKDF(root, `hl/aztec/v1/signing`) mod Fq | Memory | Never |
| Store key (OPFS SQLite) | HKDF(root, `hl/aztec/v1/store`) | Memory | Never |
| Fee Juice claim secrets (Alpha) | HKDF(root, `hl/aztec/v1/fee-juice-claim/<i>`) mod Fr | Memory | Never |
| Passkey PRF output | WebAuthn PRF of the passkey, on a random 32-byte salt | Memory, during wrap/unwrap only | Never |

The account root determines everything. The same Ethereum account always recovers the same Aztec account. Wallets sign deterministically (RFC 6979).

## 2. Passkeys (done in code)

A passkey is a second way to obtain the account root.

1. **Enrolment.** The wallet must be open. The Ethereum wallet signs the same typed data again, and the result must derive the open account's salt and signing key. A wallet that signs differently each time is refused (`MISMATCH`). It is never wrapped into a passkey that would open an empty account.
2. **Wrapping.** A WebAuthn credential is created with the PRF extension. It is resident, and user verification is required. Its PRF output on a random salt goes through HKDF to an AES-256-GCM key, which encrypts the root. The additional data is `hl/passkey-unlock/v1|evm|network|credentialId`, so a record moved to another account, network or credential does not open.
3. **Records.** A record holds the credential id, the PRF salt, the IV and the ciphertext. It contains no secret. Records are kept in `localStorage` and in the person's backup (`/api/aztec/passkeys`, signed-in wallet only, at most 10 per account and network). The server cannot open them.
4. **Unlocking.** WebAuthn `get` asks for any enrolled passkey of this account (`evalByCredential`). The root it unwraps goes once into the existing derivation (`PrivateWallet.connect`). The account, the address and the notes are the same as with the Ethereum wallet.
5. **Authenticators.** Support is decided at enrolment. A credential that returns no PRF is refused with `NO_PRF`. PRF is offered by iCloud Keychain, Google Password Manager, 1Password, Windows Hello and FIDO2 keys with `hmac-secret` (YubiKey 5 among them), depending on the browser. None of these has been tested on a real device yet (§6).

6. **Hardening (17 Nov 2026).**
   - Before any key is derived, an unwrapped root that is a 65-byte ECDSA signature must recover, over this network's typed data, to the account's own Ethereum address (`assertRootOwner`). A record that would open any other account, including the same wallet's test-network account, is refused with `MISMATCH`. A longer root is a smart-account signature (EIP-1271/6492), which cannot be checked offline; it is let through.
   - Records on this device take precedence over the backup (`mergeKeepingLocal`). The server can add a credential this device does not have. It can never replace one this device already holds.
   - The relying party is `ledgerchat.org` on the apex domain and on every subdomain (`passkeyRpId`), so a passkey enrolled on `www` also works on the apex. Browsers refuse an rpId that is not the page's own domain or a parent of it, so no other site can ask for these passkeys. A self-hosted copy uses its own host.
   - The backup refuses to move a credential to another network when that network already holds 10 records.

Decision: a passkey wraps the existing root rather than replacing it. Existing accounts keep their address, notes and Fee Juice. Sign-In with Ethereum stays the way to sign in to Ledger Chat. The passkey opens only the private wallet.

## 3. Recovery

- **Ethereum wallet kept:** it always recovers the account.
- **Ethereum wallet lost:** any enrolled passkey whose record is on the device or in the backup recovers the account.
- **Both lost:** nobody can recover the account, Ledger Chat included.

A passkey is a full key: whoever passes its user verification can spend. Removing a passkey deletes its record here and in the backup. It does not rotate the account, because the root is the same. Rotating means moving the funds to a new account.

## 4. Deferred: the passkey as the account's signing key

The target is that the signing key never leaves the authenticator: the account contract would verify a WebAuthn assertion (secp256r1 over `authenticatorData || sha256(clientDataJSON)`) in Noir. This is not done.

- It is a new account contract. It needs its own TXE tests, a recorded class, the same audit condition as every contract on Alpha (`audit: null` today) and a migration of every existing account, whose address would change.
- A WebAuthn signature has to be produced for each transaction. Its parsing (clientDataJSON, challenge, flags, counter) is attack surface that needs review.

**Residual risk until then:** the Schnorr signing key is derived in the browser from the root and held in memory while the wallet is open. A script running in the page while the wallet is open could use it. This is the same exposure as before passkeys.

## 5. G7 peer binding (strengthened)

- **Scheme v2 (`hl/aztec-binding/v2`).** The proof and the signed statement name the Aztec network (`aztec:<l1ChainId>:<rollupVersion>`). A proof made on the test network cannot stand for Alpha, and a network edited into a signed proof breaks the signature.
- **Value-moving checks.** These are `verifiedPeerBinding` with `valueBindingContext` in direct payments, agreements, the payment modal and the agreement composer. They re-verify the stored proof at each payment. On Alpha they refuse:
  - a v1-scheme proof;
  - a proof for another network;
  - a wallet that does not know its network.

  On the test network a v1-scheme proof is still accepted, for older clients.
- **Pinning.** A proof for another network is refused when the wallet knows its own network.
- **Every payment between two chat users needs a verified binding, on every network.** This covers the direct payment, the invoice rail, the escrow and the stream. A typed or pasted address in Send is not a chat identity: it is shown in full for review and is outside G7.
- **Limits, unchanged.** Trust on first use. A valid proof shows control of the signing key, not of the nullifier key. Not run between two real browsers yet (R8).

## 6. Not verified yet

- Passkeys on real authenticators: iPhone, Mac, Android, Windows and a YubiKey.
- The backup route against the production database. The migration `20261117200000_aztec_passkey_records` is additive and not applied yet.
- The G7 v2 proof between two browsers on Alpha (R8).
