# Threat model

21 November 2026. Scope: Ledger Chat as it runs today (ground truth in the state-of-the-project
prompt of the same date). STRIDE for security, LINDDUN for privacy, one table per component.
Each row says what is in place and what is not yet. Published summary: `/security#threats`.

Legend for status: **In place**, **Partial**, **Not yet**.

## Actors

| Actor | Capability assumed |
|---|---|
| Network observer | Sees traffic to and from the device, its timing and size |
| Our server, compromised or compelled | Everything Postgres, Redis and the app logs hold; can serve modified JavaScript |
| A third party in the path | XMTP nodes, Aztec sequencer and provers, TURN, PeerJS cloud, push services, Reown relay |
| A malicious contact | Can send any message and announce any address |
| A phishing site | Can ask the wallet to sign anything |
| A thief with an unlocked device | Has the browser profile |

## Sign-in (SIWE, server session)

| Threat | STRIDE / LINDDUN | Control | Status |
|---|---|---|---|
| Signature replayed or phished | Spoofing | Server nonce in an httpOnly cookie; domain checked; the screen shows every field and the domain check | In place |
| Session stolen | Spoofing, Elevation | httpOnly cookie, server check per route | In place |
| Server links wallet to sessions and IPs | Linkability, Identifiability | Shorter, device-bound sessions | Not yet |

## Direct and group messages (XMTP, MLS)

| Threat | STRIDE / LINDDUN | Control | Status |
|---|---|---|---|
| Content read in transit or on nodes | Information disclosure | MLS (RFC 9420) end-to-end encryption | In place |
| Content read on a stolen device | Information disclosure | Encrypted local database, key under a non-extractable browser key; app PIN | Partial |
| Who talks to whom, when | Linkability, Detectability | XMTP sees inbox pairs and timing | Not addressed |
| Modified client served by our server | Tampering | Reproducible builds with published hashes, servable from any domain | Not yet |

## Calls (WebRTC, TURN, signalling)

| Threat | STRIDE / LINDDUN | Control | Status |
|---|---|---|---|
| Media read in transit | Information disclosure | DTLS-SRTP between the two devices | In place |
| Signalling swaps fingerprints | Tampering, Spoofing | Ringing over XMTP; no fingerprint verification shown to people | Partial |
| Call metadata at PeerJS cloud | Linkability | Own signalling server or Ledger Relay | Not yet |
| TURN abuse | Denial of service | One-hour credentials | In place |

## Attachments and large files

| Threat | STRIDE / LINDDUN | Control | Status |
|---|---|---|---|
| Storage reads files | Information disclosure | AES-256-GCM on the device; key only in the MLS message | In place |
| Pieces reordered, dropped or swapped | Tampering | Associated data binds index and count; SHA-256 per piece | In place |
| Recipient's IP leaked to a host chosen by the sender | Linkability | Only same-origin attachment URLs are accepted | In place |
| Plaintext uploaded by a buggy client | Information disclosure | Server and relay refuse known file signatures | In place |

## Contacts, communities, Status, push

| Threat | STRIDE / LINDDUN | Control | Status |
|---|---|---|---|
| Server reads the social graph | Disclosure, Linkability | Contacts on the device, communities and Status on MLS | Not yet |
| Server reads community posts and Status | Information disclosure | Same; stated on the community screen and the landing | Not yet |
| Push reveals sender | Linkability | Opaque wake-ups | Not yet |

## Private payments (Aztec)

| Threat | STRIDE / LINDDUN | Control | Status |
|---|---|---|---|
| Amount or recipient visible on chain | Disclosure | Notes and nullifiers, proof built on the device | In place |
| Fee payer links transactions | Linkability | Private fee payment through an FPC | Not yet |
| Paying an address the contact does not control | Spoofing | Network-bound peer binding before value moves | In place |
| Contract bug | Tampering, Elevation | Internal review, TXE tests, caps per payment, no escrow or streams on Alpha | Partial |
| Lost device | Denial of service | Keys re-derived from the wallet signature; passkeys | Partial |

## Ledger Relay (in design, not deployed)

See `docs/design/ledger-relay.md`, section "Failure modes".

## Review

This model is a draft by the maintainers. It needs an outside reviewer before it is relied on.
