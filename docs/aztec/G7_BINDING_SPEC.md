# Binding an Aztec address to a messaging identity (scheme `hl/aztec-binding/v2`)

**Status:** used in production by Ledger Chat on Aztec Alpha (`lib/aztec/peer-binding.ts`).
Written so another Aztec application can implement the same check without reading our code.
License of this text and of the reference implementation: MIT OR Apache-2.0, like the repository.

## Problem

A messenger authenticates people by a messaging identity (here an XMTP inbox, bound to an Ethereum
key). A private payment goes to an Aztec address. Nothing links the two: if the address is simply
sent in a message, a relay, a compromised client or a third party can substitute its own, and the
payer cannot tell.

## The announcement

The recipient sends, inside the end-to-end encrypted conversation:

```json
{
  "type": "hl.aztec_address",
  "version": 2,
  "address": "0x<32 bytes>",
  "proof": {
    "scheme": "hl/aztec-binding/v2",
    "signingPublicKey": { "x": "0x…", "y": "0x…" },
    "salt": "0x…",
    "publicKeys": "0x…",
    "signerInboxId": "<sender inbox>",
    "recipientInboxId": "<receiver inbox>",
    "network": "aztec:<l1ChainId>:<rollupVersion>",
    "signature": "0x<64 bytes>"
  }
}
```

## The check (all must pass, in this order)

1. **Who.** `signerInboxId` equals the authenticated sender of the message, and `recipientInboxId`
   equals the receiver. A proof made for one person cannot be replayed to another.
2. **Which network.** `network` equals the receiver's own node identity (L1 chain id and rollup
   version). The same keys give the same address on every network, so without this a proof made on
   a test network would stand on a value-bearing one.
3. **Which address.** Recompute the address of a Schnorr account contract from the account artifact
   with constructor arguments = `signingPublicKey`, the given `salt` and `publicKeys`, no deployer
   and no immutables (what `AccountManager.create` does in aztec.js 6.0.0). It must equal `address`
   exactly. Because an Aztec address commits to its public keys, this also binds the announced
   privacy public keys to the address.
4. **Who controls it.** The Schnorr signature verifies with `signingPublicKey` over
   `sha256ToField("hl/aztec-binding/v2 | <address> | <signerInboxId> | dm:<recipientInboxId> | net:<network>")`, with `<address>` in lower case.

Only then is the address stored as verified for that peer.

## Rules around the check

- **Trust on first use, never silent replacement.** The first verified address is pinned per peer
  inbox. A different address later is shown as a conflict and is not used until the person confirms
  it another way.
- **Re-verify before value moves.** The stored proof is checked again (steps 1 to 4) immediately
  before each payment; a cached "verified" flag is never trusted on its own.
- **No proof, no value.** On a value-bearing network an address without a valid v2 proof can be
  saved for display but cannot receive a payment.

## What it proves, and what it does not

It proves the sender holds the **signing key** that authorises transactions for that address, and
that the address commits to the announced public keys. It does not prove the sender holds the
secret **privacy keys** behind those public keys: Aztec has no standard way to prove possession of
them. A dishonest peer could announce an address built from someone else's public keys; funds sent
there would be unusable by both, which harms only people who choose to pay that peer. The attack
the scheme closes is substitution by anyone other than the peer.

## Reference implementation and tests

`lib/aztec/peer-binding.ts` (`verifyAddressProof`, `recordPeerAnnouncement`, `verifiedPeerBinding`)
and `test/unit/aztec/peer-binding.test.ts`.
