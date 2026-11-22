# Ledger Relay

`Status: in design. Reference implementation v0.2.0, not deployed for users. Internal review only.`

Ledger Relay is a small, stateless service that anyone can run: a company on its own domain, a community, or Humanity Ledger. It carries only what Ledger Chat cannot end-to-end encrypt away, and never plaintext:

| Capability | What it does | What the relay can see |
|---|---|---|
| TURN credentials | Hands out short-lived credentials for a coturn server, so calls work across strict networks | That a client asked, and when. The username carries no identity |
| Signalling | PeerJS-compatible WebSocket hub for call set-up, as a fallback to ringing over XMTP | Peer ids (derived by the app, no wallet address), timing, and the SDP the two browsers exchange |
| Encrypted files | Stores ciphertext addressed by its SHA-256, deleted on expiry | Opaque bytes, their size and the time of upload and download |
| Notifications | Sends empty Web Push wake-ups to a device that registered an opaque token | A push endpoint, an opaque token and the time of each wake |

It never sees message content, keys, wallet addresses or amounts, and **it never carries payments**: those are proved on the user's device and settle on Aztec Network.

The design rationale, trust boundaries and failure modes are in [`docs/design/ledger-relay.md`](../docs/design/ledger-relay.md).

## Run your own relay

You need a host with a public address, Docker, and a TLS certificate for the relay's domain (browsers only talk to `https` and `wss`).

1. Copy the configuration and fill it in:

   ```sh
   cd relay
   cp .env.example .env
   ```

   Set `RELAY_TURN_SECRET` to a long random value, `RELAY_TURN_URLS` to your host, and `RELAY_ALLOWED_ORIGINS` to the origins your users open Ledger Chat from. To limit the relay to your organisation, list bearer tokens in `RELAY_ACCESS_TOKENS`.

2. Start the relay and coturn:

   ```sh
   docker compose up -d
   ```

3. Put the relay behind your TLS proxy (port 8080 to `https://relay.example.org`), with WebSocket upgrades allowed on `/peerjs/peerjs`. Open UDP 3478, TCP 3478, TCP 5349 and UDP 49152 to 65535 for coturn.

4. Check it:

   ```sh
   curl https://relay.example.org/v0/info
   ```

   The answer lists the capabilities this relay offers and the limits it applies.

On Kubernetes, the chart in [`helm/ledger-relay`](helm/ledger-relay) runs the same image as a non-root, read-only container; put secrets in a Secret named `ledger-relay`.

On Railway, create a service from this repository (not from a copy of it) and set, in its settings:

- Root Directory: `relay`
- Config-as-code path: `/relay/railway.toml` (Railway reads this path from the repository root, not from the root directory)
- Variables: `PORT=8080` and `RELAY_ALLOWED_ORIGINS` with the origins your users open Ledger Chat from
- Custom domain on port 8080

The deploy is healthy when `https://<your relay domain>/health` answers `{"ok":true}`. If it answers with a web page instead, the service is building something other than `relay/`. Railway runs one replica without a volume, so stored blobs and push subscriptions are lost on restart unless you attach a volume at `/data`.

## Point Ledger Chat at it

The client support is behind a flag that is off by default (`lib/relay/relays.ts`):

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_LEDGER_RELAY=1` | Use relays at all |
| `NEXT_PUBLIC_LEDGER_RELAYS=https://relay.example.org` | The organisation's relays, comma separated |
| `NEXT_PUBLIC_LEDGER_RELAY_PIN=1` | Use only those relays, for data residency |
| `NEXT_PUBLIC_PEERJS_HOST`, `_PATH`, `_KEY` | A PeerServer of your own; when set it wins over the relay |

With the flag on, the app asks the first healthy relay for TURN credentials and falls back to `/api/calls/ice`, then to STUN only, exactly as before. Call set-up also goes through the first organisation relay (PeerJS protocol at `/peerjs/peerjs`, key `peerjs`) instead of the public PeerJS cloud, unless `NEXT_PUBLIC_PEERJS_HOST` names another server (`lib/calls/media.ts`, `peerServerOptions`). Add the app's origin to `RELAY_ALLOWED_ORIGINS`, or the relay refuses its WebSocket.

## API, protocol `ledger-relay/0`

| Method and path | Body | Answer |
|---|---|---|
| `GET /health` | | `{ ok: true }` |
| `GET /peerjs/peerjs/id` | | A random id, for PeerJS clients that ask for one. The list of peers is never given (`/peers` answers 401) |
| `GET /v0/info` | | Name, operator, protocol, capabilities, limits, signalling path and key, push public key |
| `GET /v0/turn` | | `{ iceServers: [{ urls, username, credential }], ttl }` |
| `PUT /v0/blobs/{sha256}` | Ciphertext. Optional `X-Relay-TTL` in seconds | `201 { hash, expiresAt, deleteToken }`; `422` if the body does not match its hash or looks like an unencrypted file; `507` when full |
| `GET` or `HEAD /v0/blobs/{sha256}` | | The bytes, as `application/octet-stream`, `no-store` |
| `DELETE /v0/blobs/{sha256}` | `X-Delete-Token` header | `204` |
| `POST /v0/push/register` | `{ subscription: { endpoint } }` | `201 { token, expiresAt, publicKey }` |
| `POST /v0/push/wake` | `{ token }` | `202`; at most one push every two seconds per token |
| `DELETE /v0/push/{token}` | | `204` |
| `GET /peerjs/{key}/id`, WebSocket `/peerjs/peerjs` | | PeerJS server protocol |
| `GET /metrics` | Bearer `RELAY_METRICS_TOKEN` | Counters, Prometheus text format |

With `RELAY_ACCESS_TOKENS` set, `/v0/turn`, uploads and push registration need `Authorization: Bearer <token>`. Downloads and wake-ups do not: the hash and the token are the capability, and they travel only inside MLS messages.

## Privacy and operations

* Logs are counters. No address, hash, id or token is written anywhere. Client addresses stay in memory for the rate limiter's one-minute window.
* Blobs live in one directory, one file each plus a small metadata file (expiry and the SHA-256 of the delete token). A sweep removes expired files every ten minutes.
* Signalling state is in memory: restarting the relay drops call set-ups in progress, not calls, whose media flows peer to peer or through coturn.
* coturn is configured to refuse relaying to private and loopback ranges.

## Tests

```sh
cd relay && npm install && npm test
```

The same cases run in the repository suite through `test/unit/relay/relay.test.ts`.

## What is not done yet

* No lockfile: generate `package-lock.json` with `npm install` before building images you deploy.
* No reproducible image build, SBOM or signed release yet.
* No load test. The target is a decision for Stefan; the method and results will be published with it.
* The service worker does not yet handle empty wake-up pushes; until it does, the push relay is not used by the app.
* No relay is deployed for users. The landing labels Ledger Relay "In design" until the Phase 2 exit criteria are met: two users on an organisation's own relay message, call and post Status with ledgerchat.org's backend blocked.

## Licence

MIT or Apache-2.0, like the rest of the repository.
