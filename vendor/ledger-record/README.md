# Ledger Record

A sealed object addressed to the members of a conversation. [Ledger Chat](https://github.com/humanityledger/Humanity-Ledger) is the room. This repository is the record.

The chat message carries a pointer. The object itself is ciphertext. Opening it checks three things: the members are the set that was named, the version hash still matches, and the ciphertext still matches its digest. Then it decrypts.

This package does not create accounts, does not talk to Aztec, and does not move money. A handoff record can name "open a private payment" or "open a private agreement". Ledger Chat is the only side that acts on that.

`2.0.0 · not externally audited`

Version 2 wraps each record to the MLS exporter secret of one epoch when the messaging client can export it. This browser SDK cannot, so a note is sealed inside the encrypted message instead. The key is then protected by the same MLS message as the rest of the chat. It is not a separate epoch wrap. Read [SPEC.md](SPEC.md) and [SECURITY.md](SECURITY.md). Version 1 messages still open.

## What a record is

* **Note.** Text, at most 8 KB, ciphertext inside the conversation. The server never receives it.
* **File.** Up to 20 MB. Ciphertext goes to Ledger storage. The pointer carries the path `/api/chat/attachments/…` and the digest. A pointer cannot name another host.
* **Handoff.** A payment or an agreement, plus one address. No amount, no token, no secret from the contract.

A later version of the same record keeps the id, uses a new key, and points at the previous version hash. Someone who joins later is not given the older keys.

## How Ledger Chat uses it

The chat depends on this package. It seals a note or a file, sends the pointer as one message of type `ledger.record`, and draws a card. Lists, notifications and copy use `recordPreview`, which never includes the key.

The record key travels inside that message because the conversation is already end-to-end encrypted. The epoch is the hash of the member ids, so a pointer cannot be moved to a different set of people without failing the version hash.

See [SPEC.md](SPEC.md).

## Licence

MIT OR Apache-2.0, the same terms as Humanity Ledger.
