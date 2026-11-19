# Ledger Record, version 1

The durable half of Ledger Chat. Speech stays in the chat. What has to outlast the thread is a record.

## The split

| Ledger Chat | Ledger Record |
|---|---|
| People, calls, presence | One sealed object |
| The Aztec wallet and settlement | A handoff that only names an action |
| MLS delivery of the pointer | Epoch, version hash, digest, ciphertext |

Record has no accounts. If the transport stops being XMTP, or settlement stops being Aztec, a record is still members, an epoch, a hash chain and ciphertext.

## Pointer

A JSON text message, type `ledger.record`, version 1. The conversation's existing encryption carries it. Fields, in order:

`type`, `v`, `id`, `kind`, `generation`, `epoch`, `head`, `prev`, `scheme`, `key`, `nonce`, `digest`, `bytes`, `label`, and exactly one of `inline` or `url`. A handoff also has `action` and `peer`.

Any other field is rejected. Hex is lowercase. The file URL matches `/api/chat/attachments/` and 32 hex characters, so opening a record cannot make the browser fetch an arbitrary host.

## Hashes

Membership epoch: SHA-256 of the member ids, sorted, joined by a newline.

Version head: SHA-256 of these lines:

```
ledger.record/1
id
generation
epoch
prev
digest
bytes
kind
label
```

The storage path is not in the head. The bytes are. The first version's `prev` is 64 zero digits. The next version keeps the id, adds one to `generation`, sets `prev` to the previous head, and uses a new key.

## Cipher

AES-256-GCM. The key is 32 random bytes. The nonce is 12 random bytes. The digest is SHA-256 of the ciphertext, tag included. Decrypt runs only after the digest matches. A digest compare does not stop at the first different character.

## Kinds

* `note` — UTF-8, at most 8 KB, `inline` ciphertext.
* `file` — at most 20 MB, `url` only.
* `handoff` — the plaintext is exactly `{"action":"pay|agreement","peer":"0x…"}` in lowercase. No amount.

## What this version does not do

It does not wrap the key to each member with a separate public key. The pointer's key is protected by the conversation that carries the pointer. When the set of people changes, a holder of the plaintext seals a new version for the new epoch. Older versions stay with the people who already had them.
