# Ledger Record security

This note says what version 2 protects, what it does not, and what is left. It is not an audit.

## Protected, when the exporter secret is real

* Outsiders who see the pointer or the file ciphertext cannot read the body. The content key is not in the pointer. The file ciphertext is AES-256-GCM under that key, with associated data that binds the conversation, the MLS epoch number, the member set, the generation, the kind, and the label.
* A modified ciphertext, wrap, label, member set, or epoch number fails closed. Opening does not return a partial body.
* A record sealed under epoch N is not unwrapped by the exporter of epoch N+1. New records use the new epoch. Old records stay with whoever still has that epoch's exporter output or a stored content key.
* A late joiner, and a removed member who did not keep the content key, cannot open earlier records once that epoch secret is gone.
* Wiping the local key store removes content keys from this device. It does not delete them from other members' devices, and it does not make a current-epoch record unreadable to someone who can still run the exporter.
* A handoff does not carry an amount, a token, or a contract secret.
* Version 1 messages still open, and they are labelled as older records whose key is inside the message.

## Not protected

* The installed XMTP browser SDK does not expose MLS-Exporter. Until it does, Ledger Chat refuses to seal a version 2 record. It will not fall back to putting the key in the message, and it will not use `getHmacKeys`. Those keys are for another purpose. Using them as a wrapping key would be key reuse, and some of them are shared with push infrastructure.
* An unlocked device that can run the exporter for an epoch can open every record of that epoch. Locking the screen is not, by itself, destruction of the exporter secret.
* The local key store uses a non-extractable AES key in IndexedDB, the same kind of boundary as the message database. A copy of the profile files, without this origin's key, cannot unwrap. An attacker who can use the unlocked browser profile can.
* SecureVault's master secret is recoverable from localStorage. Record content keys are not stored there.
* MLS forward secrecy applies only after the messaging client destroys the epoch secret. This library cannot see whether it did.
* A member of the conversation is not kept out. They can copy what they opened, and they can seal a misleading record.
* Version 1 records have no independent forward secrecy. The key is in the message. Anyone who can read that message can open the record, including a backup of the decrypted transcript.
* Post-quantum confidentiality is not added by this library. It is inherited only if the MLS handshake that produced the exporter secret was itself hybrid (XWing or equivalent). A quantum adversary who recovers that secret recovers the wrap.
* Tor, site blocking, and separating the payment identity from the messaging identity are properties of Ledger Chat's transport and of Aztec. This library binds a record to a conversation id and an epoch. It does not route traffic and it does not pay.
* The file ciphertext is stored by Ledger Chat's attachment service. The service sees the length and the time of upload. It does not see the body if the ciphertext is honestly produced. A seized server does not yield the body without the content key.
* JavaScript AES-GCM in Web Crypto is the implementation the browser provides. This library does not claim a software constant-time AES. Digest comparison of hex strings does not stop at the first differing character. The epoch secret and content keys are wiped with `fill(0)` when the library is done with its copies. That does not scrub every copy the engine may have made.

## Residual risks

* The exporter, once the SDK exposes it, is only as compartmented as the client. If the client returns the same bytes for every label, domain separation fails. Callers must pass the label `ledger-record`, the context `ledger-record/v2`, and length 32, and must check the length.
* A seized unlocked device in the current epoch is outside the protection of the wrap.
* Local keys survive epoch rotation on purpose, so the owner can still open what they already received. A wipe is what removes them. There is no time lock.
* The attachment server can delete ciphertext. Opening then fails. That is availability, not confidentiality.
* There has been no external cryptographic review of this version.

## Device seizure

* Unlocked device, current epoch: the person holding it can run the exporter and open records of that epoch. A passphrase or passkey is not in the way unless the user turned that mode on and the session is locked.
* Locked session, passphrase or passkey mode: the in-memory key is gone. Opening needs the passphrase or the authenticator again. A wrong one fails closed and the message does not say which check failed beyond "did not open".
* Locked session, device-only mode: this is not a user secret. The non-extractable browser key can unwrap again as soon as this origin runs. Say that to the user. Do not call it a lock.
* Wiped device: local content keys are deleted. Other members who stored the key, or who still have the epoch exporter, still open the record. A removed member who never stored it, and who lost the epoch, cannot.
* Stolen locked phone, profile copy without the browser key: the IndexedDB wrap does not unwrap. The epoch exporter is not on the copied disk unless the messaging client stored it there. This library does not store the exporter.

## Later work

* Use the MLS exporter the day the browser SDK exposes it. Do not invent a second channel for the secret.
* Confirm, per XMTP release, whether the group handshake was XWing. Say so in the client's security note. Do not say it here until that release is the one Ledger Chat runs.
* A user-held wrap (a passphrase or a hardware key) in front of the local key store, for people who want records to stay unreadable on an unlocked seized device even during the current epoch.
* Chunk uploads that never assemble a 20 MiB buffer, if the attachment API grows a streaming body. The cipher and the digest are already chunked. The upload still hands the platform one blob.
