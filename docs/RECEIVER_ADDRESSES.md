# Receiver addresses

Status: 17 November 2026. Module 2 of the zk.money / Nyx parity plan. Written and tested locally (Hardhat, TXE, unit tests). **Not deployed on any network.**

Code:
- `contracts/portal/HLReceiver.sol` (`HLReceiver`, `HLReceiverFactory`);
- `lib/portal/receivers.ts`;
- `components/zk/wallet/ReceiversCard.tsx`.

Tests:
- `test/portal/HLPortal.test.ts` ("HLReceiver");
- `test/unit/portal/receivers.test.ts`.

## 1. What it is

A receiver address is an ordinary Ethereum address a person gives to someone who pays them.

1. ETH, DAI, USDC, USDT or WETH sent there is forwarded by anyone into `HLPortal` (`contracts/portal/HLPortal.sol`) as a private deposit.
2. The person claims it on Aztec into their private balance.

An account can have up to 64 receivers, one per payer or per purpose.

## 2. Derivation (client)

From the account root R (the wallet signature every key comes from; also obtained from a passkey, `docs/ACCOUNT_MODEL.md`):

| Value | Formula | Where it is |
|---|---|---|
| P | HKDF-SHA256(R, salt `humanity-ledger/portal`, info `hl/portal/v1/master`, 64 bytes) | wallet memory |
| seed_i | HKDF-SHA256(P, same salt, info `hl/portal/v1/receiver/<i>`, 96 bytes) | transient |
| secret_i | seed_i[0..48) mod Fr | wallet memory, used only in the claim proof |
| secretHash_i | poseidon2([secret_i], DOM_SEP__SECRET_HASH) (aztec.js `computeSecretHash`) | Ethereum (receiver storage, deposit events) |
| rescueKey_i | seed_i[48..96) mod n(secp256k1) | wallet memory |
| rescueSigner_i | Ethereum address of rescueKey_i | Ethereum (receiver storage) |
| receiver_i | CREATE2(factory, keccak256(abi.encode(secretHash_i, rescueSigner_i)), EIP-1167(implementation)) | Ethereum |

The same root gives the same receivers on any device. Every value is recomputed when the wallet opens; nothing is stored but the count of receivers in use.

## 3. Unlinkability: what is enforced

**Claim:** no data on Ethereum or Aztec contains, or is computable from, the person's Aztec address. No data relates two receivers of the same person.

1. **Ethereum never sees the Aztec account.**
   - A receiver stores `secretHash_i` and `rescueSigner_i` only.
   - The deposit message carries `content = sha256ToField(mint_to_private(amount))`, the secret hash, the portal as sender and the asset's Aztec token as recipient.
   - The Aztec recipient is not a parameter of any L1 function.
   - Tested: no calldata, event topic, event data, storage slot or message field of the whole deposit path contains the account. Two people depositing the same amount send identical message contents.
2. **The secret hash reveals nothing.** It is a Poseidon2 hash of a value derived by HKDF from the root. Inverting it, or relating it to the account's keys or address, means breaking Poseidon2 or HKDF-SHA256.
3. **The claim does not reveal which deposit it consumes.**
   - `PortalToken.claim_private` (`contracts/aztec/portal_token`) consumes the message privately. The message, its leaf index, the secret, the amount and the recipient are private inputs of the proof.
   - The only public output tied to the message is its nullifier, poseidon2(message_hash, secret). It is indistinguishable from any other nullifier without the secret.
4. **The claim changes no public state.** `PortalToken` keeps balances as private notes and has no public total supply. A token whose private mint updates a public supply (the standard token bridge pattern) would publish the amount at the moment of the claim. This one does not.
5. **Receivers of one account are unrelated.** Their seeds come from different HKDF labels, so their secret hashes, rescue signers and CREATE2 addresses share nothing (tested). Different accounts give different receivers (tested).
6. **The message sender is always the portal.** Receivers forward through the portal, so the Aztec side sees one sender for every deposit. All receivers of all people form one anonymity set per asset.

## 4. Rescue

A receiver can hold something the portal refuses: another token, or an amount above the caps on a given day. The person's `rescueKey_i` signs an EIP-712 `Rescue(token, to, amount, nonce, deadline)`, and anyone submits it.

- Revealing the signature links that receiver to the rescue destination only.
- `rescueKey_i` is not the deposit secret, so a rescue never exposes deposits.
- Tested: wrong signer, replay and expired signatures are refused.

## 5. What is NOT enforced (residual risks)

These are metadata leaks, not cryptographic links. The wallet mitigates where it can and says the rest.

1. **The claim's fee payer is public.** Until private fees exist (Module 3), the claim transaction pays Fee Juice from the person's account. That account is visible as having sent a transaction at that time.
   - With few deposits in flight, timing can relate "a deposit to receiver R" with "a transaction by account A".
   - Mitigation in the wallet: a claim waits a random 10 min to 6 h after the deposit is first seen, drawn once per deposit (`claimPlan`, `ReceiversCard`).
   - Removed by Module 3 (fee paid privately).
2. **Amounts are public on Ethereum.** The amount of each deposit is visible on L1. It is not visible on Aztec at claim time (point 4 above). Correlation by amount needs the timing link of point 1.
3. **Who forwards is visible on Ethereum.** If the person forwards from their own known Ethereum address, that address is linked to the receiver, on Ethereum only. The wallet's text suggests leaving the forward to the payer or to a relayer.
4. **One receiver groups its payments.** Every payment to the same receiver is visibly grouped. The wallet tells people to give a different receiver to each payer.
5. **Anonymity set.** Unlinkability is only as good as the number of other deposits and claims in the same period. On a new portal the set is small.

## 6. Status

| Item | State |
|---|---|
| `HLReceiver`, `HLReceiverFactory` | Written. Hardhat suite in CI (`npm run test:contracts`). Not deployed. Not audited. |
| `PortalToken` (Aztec) | Written. TXE tests in CI (`Aztec contracts` workflow). Compiled by CI, not locally. Not deployed. |
| Client derivation, address prediction, message contents | Unit tested. Vectors shared with Solidity and Noir. |
| Wallet UI | Receivers, QR, deposit check, claim, withdraw. Hidden behind `PORTAL_CONFIG`, which is unset everywhere. |
| Two-account end-to-end run | Not done (needs a deployment on a test network). |
