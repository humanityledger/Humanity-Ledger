# Design note: Ledger Relay v0

21 November 2026. Status: in design, reference implementation in `relay/`, not deployed. Needs an independent review before any user traffic.

## Goal

Take the Ledger Chat backend out of the availability path and, step by step, out of the trust path, without building a new network. Messages already travel over XMTP and payments settle on Aztec; what remains on our server is what cannot be end-to-end encrypted away: TURN for calls, signalling, a place to put encrypted files, and push. Ledger Relay is that remainder as one small service anyone can run.

## Assets and trust boundaries

| Asset | Where it lives | Who may read it |
|---|---|---|
| Message content | Devices, XMTP (MLS ciphertext) | The people in the conversation |
| File and Status media keys | Inside MLS messages | The people in the conversation |
| File and Status media bytes | Relay blob store, as ciphertext | Nobody without the key |
| Call media | Peer to peer, or through coturn, DTLS-SRTP | The people on the call |
| Call set-up (SDP, candidates) | Signalling hub, in memory, seconds | The relay operator, the two peers |
| Push subscription | Relay, mapped to an opaque token | The relay operator, the push service |
| Payments | Device and Aztec | Never the relay |

The relay operator is trusted for availability only. It is not trusted with content, keys or identity.

## Construction

* **TURN**: coturn with `use-auth-secret`; the relay issues `<expiry>:<random>` usernames with an HMAC-SHA1 password, as coturn's TURN REST API expects. One-hour default lifetime. coturn refuses private and loopback peers.
* **Signalling**: the PeerJS server protocol, so the existing client works by changing `NEXT_PUBLIC_PEERJS_HOST`. Messages are forwarded with `src` set by the hub (a client cannot spoof it), queued for five seconds for a peer not yet connected, then expired back to the sender. 64 KB per message, 50 messages a second per peer.
* **Blob store**: content-addressed by the SHA-256 of the ciphertext, verified on upload. Expiry by default after 24 hours, at most 7 days. A delete token is returned to the uploader and stored only as its SHA-256. Uploads that begin with a known file signature, or that are mostly printable text, are refused: the store cannot prove encryption, but it catches a client that skipped it.
* **Push**: VAPID (RFC 8292) with ES256, empty payload, so the push service and the relay see no content. Endpoints are limited to browser push services, which closes the relay as a request forwarder. One wake every two seconds per token.
* **Client** (`lib/relay`): an organisation list from build variables, a user list on the device, optional pinning to the organisation's relays, health probes with failover, and verification of a signed relay list (ECDSA P-256) against a public key set at build time. No list key is set yet, so signed lists are refused.

## Alternatives rejected

* **A ledger of our own** for messages or relay state: messaging scales by fan-out and delivery, not global ordering; a chain adds cost, latency and permanent metadata.
* **Server-side encryption of files**: the server would hold the key. Keys belong in MLS.
* **Wallet-authenticated relay access**: it would tie relay requests to wallet addresses. Organisations use bearer tokens; the open mode relies on rate limits.
* **A custom signalling protocol**: no gain over PeerJS today, and it would need a client change and its own review.

## Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Relay down | No TURN from it, no new signalling through it, files on it unreachable | Clients fail over to the next relay, then to the current backend, then to STUN only |
| Relay restarted | Call set-ups in progress fail and are retried; blobs and push tokens survive on disk | Signalling state is short-lived by design |
| Relay operator malicious | Can drop or delay traffic, observe timing, SDP and IPs of peers that use it | Content, keys and amounts are never present; users can pick or run another relay |
| Blob store full | Uploads refused with 507 | Clients try the next relay |
| TURN secret leaked | Anyone can mint TURN credentials until it is rotated | Rotate the secret; credentials expire within the TTL |
| Push token leaked | Someone can wake a device, at most once every two seconds | The device unregisters and registers again |

## What this note does not cover

Contacts, communities and Status moving to MLS (separate design notes), the XMTP gateway or payer if the decentralised network requires one (pending `docs/ops/xmtp-network.md`), and the load-test target, which is Stefan's decision.
