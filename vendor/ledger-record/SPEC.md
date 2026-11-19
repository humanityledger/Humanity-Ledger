# Ledger Record, version 2

A record is a sealed object addressed to the members of one MLS conversation. The pointer travels inside an already MLS-protected message. The content key does not.

Version 1 messages still open. New records are version 2. Version 1 put the content key in the pointer. Version 2 does not.

## Roles

Ledger Chat delivers the pointer and holds the MLS group. This library seals and opens bytes. It does not fetch, does not store, and does not move money. A handoff names an action, an address, and an optional 32-byte commitment. It does not name an amount, a token, or a contract secret.

## Epoch secret

The only accepted input is 32 bytes declared `source: "mls-exporter"`.

Those bytes are the output of MLS-Exporter (RFC 9420 §8.6) for:

* label: `ledger-record`
* context: the UTF-8 bytes of `ledger-record/v2`, a zero byte, and the conversation id
* length: 32

The library does not derive this secret itself. The installed XMTP browser SDK, as of the build Ledger Chat ships, exposes the epoch number and per-epoch HMAC keys. It does not expose the exporter. HMAC keys are for a different purpose and are rejected. Sealing fails closed until the SDK grows an exporter with that label, context, and length.

The epoch number is the MLS epoch as a decimal integer with no leading zeros. It is public binding data, not a secret.

## Key derivation

```
salt = SHA-256("ledger-record/v2" || 0x00 || conversationId || 0x00 || mlsEpoch)
KEK  = HKDF-SHA-256(ikm = exporter, salt = salt,
                    info = "ledger-record/v2/kek" || 0x00 || membership || 0x00 || kind,
                    L = 32)
```

`membership` is the hex SHA-256 of the member ids, sorted, joined by `\n`. `kind` is `note`, `file`, or `handoff`.

A fresh 32-byte content key is wrapped with AES-256-GCM under the KEK. The wrap nonce is 12 random bytes. The associated data is the canonical binding below, without a chunk index. The pointer carries `wrap` and `wrapNonce`. It does not carry the content key or the KEK.

## Content encryption

AES-256-GCM. The base nonce is 12 bytes: 8 random bytes and 4 zero bytes. Chunk `i` uses that nonce with the last 4 bytes replaced by `i` as a big-endian uint32. A nonce is never reused under the same content key.

Plaintext chunks are 64 KiB, except the last. Each chunk's associated data is the canonical binding plus the chunk index and the chunk count, both uint32 big-endian.

Notes and handoffs are one chunk and at most 8 KiB, and the ciphertext is inline. Files are at most 20 MiB. Their ciphertext is the concatenation of the chunk ciphertexts (tag included). The digest is SHA-256 of that concatenation, computed incrementally, so the whole file need not be hashed as one buffer. The storage path is `/api/chat/attachments/` plus 32 hex characters. It is not inside the version hash. A path on another host is rejected. When that storage answers that it is unavailable and the ciphertext still fits in one message, the file record carries `inline` instead of `url`. A note never has a URL.

## Associated data

Length-prefixed, in order:

```
"ledger-record/v2" || 0x00
uint16 conversationId length || conversationId
uint16 mlsEpoch length || mlsEpoch
uint16 membership length || membership hex
uint32 generation
uint8  kind (1 note, 2 file, 3 handoff)
uint16 label length || label
16-byte id
32-byte previous head
uint16 installation length || installation
[uint32 chunk index || uint32 chunk count]   // content chunks only
```

`aad` on the pointer is the hex SHA-256 of the binding without a chunk index. Opening recomputes it and rejects a mismatch.

## Version hash

```
SHA-256(utf8(
  "ledger-record/v2/head\n" ||
  id || "\n" || generation || "\n" || conversationId || "\n" || mlsEpoch || "\n" ||
  membership || "\n" || prev || "\n" || digest || "\n" || bytes || "\n" ||
  chunks || "\n" || kind || "\n" || label || "\n" || installation || "\n" ||
  bodyGen || "\n" || bodyEpoch || "\n" || bodyInstallation || "\n" || bodyPrev || "\n" || aad
))
```

`bodyGen` is the generation that encrypted the bytes. `bodyEpoch`, `bodyInstallation` and `bodyPrev` are empty unless this version only rewraps an older ciphertext, in which case they are the values that ciphertext was bound to. Seal, open and chain verification call one function, `recordHeadLines`, so those three paths cannot drift.

The first version's `prev` is 64 zero hex digits. The next version keeps the id, adds one to `generation`, sets `prev` to the previous head, and uses a new content key. The chain check requires the same membership hash on every version it is asked to verify.

## Membership changes

A new record uses the exporter of the current epoch and the current member set. An older record stays wrapped to the exporter of the epoch named on it.

* A member who unwrapped it may store the content key locally. They can open it after that epoch secret is destroyed.
* A removed member who never stored the content key, and whose client no longer has that epoch's exporter secret, cannot open it.
* A late joiner does not receive previous epoch secrets from MLS. They cannot open earlier records. They can open records sealed in epochs they belong to.
* Wiping the local key store deletes the content keys on this device only. Other members who stored the key, or who still have that epoch's exporter secret, are unaffected.

Forward secrecy and post-compromise security of a record are exactly those of the MLS epoch whose exporter wrapped it, plus local deletion of the content key. This library does not delete MLS epoch secrets. That is the messaging client's job. If the client keeps an epoch secret, records sealed under it remain openable.

## Handoffs

The plaintext is exactly:

```
{"action":"pay|agreement","commitment":"<64 hex>","peer":"0x<40 hex>"}
```

`commitment` is 64 hex digits. Sixty-four zeros means the caller committed to nothing. The pointer repeats action, peer, and commitment so the chat can offer the action without an extra secret. It does not contain an amount, a token, or a contract secret. Opening checks that the plaintext matches those three fields.

## Version 1

A version 1 pointer is recognised and opened by the old rules: the content key is in the message, AES-256-GCM, no exporter. New seals do not produce version 1. A version 1 record does not gain forward secrecy by being displayed in a newer client. Re-sealing it as version 2 is a new version under a current exporter, and it requires the plaintext.

## Installation id

The sealer's XMTP installation id, when the client has one, is a public field on the pointer and is inside the associated data and the version hash. It names which device sealed the record. It is not an input to the KEK. Putting it in the exporter context would make the wrap unreadable by every other member and by the same person's other devices. Those devices are current members. They open the record with the shared exporter secret.

The exporter context is the UTF-8 bytes of `ledger-record/v2`, a zero byte, and the conversation id. Every member of that conversation derives the same context. The label stays `ledger-record` and the length stays 32.

## Rewrap

`rewrapToEpoch` wraps the same content key for a new epoch. The ciphertext, digest, and content nonce stay. The new pointer's generation increases and its `bodyGen` stays the generation that encrypted the bytes, so the content associated data still matches. A late joiner can open that new pointer only if a current member chose to rewrap and the late joiner has the new exporter secret. Removed members are not given the content key. If they already stored it, they already had the plaintext. The rewrap does not change that.

## Local key

A device may wrap its copy of the content key under Argon2id (RFC 9106, `@noble/hashes`) or under HKDF of a WebAuthn PRF result. Production passphrase parameters are 64 MiB, 3 passes, one lane. One lane is deliberate: the browser runs extra lanes one after another, so more lanes would stall a phone without adding memory hardness. Locking zeroizes that key in memory. Wiping deletes the local store. Neither action deletes another member's copy.

The device-only IndexedDB wrap, with no passphrase and no passkey, is not a lock against someone who can use this browser profile. It only stops a copy of the files from unwrapping without this origin's non-extractable key.

## Chunks, memory, and compression

Chunk size stays 64 KiB. Smaller chunks add AES-GCM calls on a slow phone. Larger chunks keep more plaintext live. 64 KiB is one allocation a low-end phone can spare, and on Tor the round trip dominates the transfer, not this choice. The file path reads one slice, encrypts it, wipes the slice, and keeps ciphertext. It does not hold the full plaintext and the full ciphertext together. Timings are `encryptMs`, `chunks`, `bytes`, and `chunkBytes` on the seal result. Measure a 10 MB and a 20 MB file with those fields on a mid-range phone. This repository does not invent a number for a device it has not run on.

Chunk AES can run in a module worker (`src/worker.ts`). The bytes and the key are the same as on the main thread. If the worker cannot start, the same Web Crypto calls run here.

Compression before encryption is not offered. A shorter ciphertext reveals that the bytes compressed. Padding back to the original size would hide that and would also save no bandwidth. Neither result is worth shipping.

## What this specification does not claim

It does not claim post-quantum confidentiality of its own. A quantum break of the MLS handshake that produced the exporter secret also recovers that secret, and with it the wrap. Post-quantum protection of the record key is whatever post-quantum property that MLS handshake actually has (XMTP's XWing work, when that handshake was used). This library does not run ML-KEM. A JavaScript ML-KEM whose ciphertext sat inside a classically recoverable MLS plaintext would not help, and a from-scratch ML-KEM would be a liability.

It does not claim that an unlocked device in the current epoch is safe. Anyone who can run the exporter on that device can unwrap records of that epoch.

It does not claim resistance to a malicious member. A member can seal a false label or a false handoff. The cryptography stops outsiders and former members who lack the key. It does not stop the people in the conversation.
