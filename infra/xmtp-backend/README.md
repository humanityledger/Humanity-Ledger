# Ledger Chat's own XMTP backend

The configuration for the backend Ledger Chat will run when the network hosted by XMTP Labs shuts down (announced 22 Oct 2026 for early 2027). The plan, the order of the steps and the gates are in [`docs/xmtp/SELF_HOSTED_MIGRATION.md`](../../docs/xmtp/SELF_HOSTED_MIGRATION.md).

**Staging since 24 Nov 2026** (phase M1), on Railway, for tests only. No user is on it. The image and the SDK it pairs with are release candidates (`8.0.0-rc4`).

| Staging | Value |
|---|---|
| Services | `xmtp-backend-staging` (image `ghcr.io/xmtp/backend:8.0.0-rc4`, config in `XMTP_CONFIG`), `xmtp-postgres` (PostgreSQL 18, its own 5 GB volume, private network only) |
| Identifier | `org.ledgerchat.xmtp.staging`. It differs from production on purpose, so no client database is ever bound to both |
| Domain | `xmtp.ledgerchat.org` → CNAME `57rur5sk.up.railway.app`, plus the `_railway-verify` TXT record shown in Railway |
| Auth | JWKS from `https://ledgerchat.org/api/xmtp/jwks`. The backend fetches it at startup and refuses to start without it |
| Database TLS | `sslmode=require` on Railway's private network (the image's certificate is self-signed). Production uses `verify-full` |
| Differences from `config.toml` | No `[chains]`, so smart-contract wallets are not verified in staging. No `[rate_limits]`, which rc4 refuses |

## What runs

| Part | Value |
|---|---|
| Image | `ghcr.io/xmtp/backend:8.0.0-rc4`, pinned by tag and digest in the deploy |
| Database | PostgreSQL 17 or later. It holds all durable state, so it is the thing to back up |
| Port 5050 | gRPC, gRPC-Web and health. Plaintext, so it stays private |
| Port 9464 | Prometheus metrics. Never public |
| TLS | Ends at a load balancer that passes gRPC-Web through unbuffered, along with CORS preflight, headers and gRPC trailers |
| Auth | JWT checked against our JWKS (`[auth] jwks_url`). Tokens come from `POST /api/xmtp/token` after sign-in |

## Where to host it

According to XMTP, Railway, where the app runs today, is **development only** for this backend: its HTTP edge does not carry native gRPC. Production goes on Fly.io, AWS ECS (Fargate) or Kubernetes, all of which XMTP documents. Postgres sits with the backend, and backups are taken before every upgrade.

## Run locally

```bash
docker run --rm -p 127.0.0.1:5050:5050 \
  -e XMTP_DATABASE_URL=postgres://user:password@host:5432/xmtp_backend \
  -e XMTP_JWKS_URL=http://host.docker.internal:3000/api/xmtp/jwks \
  -v "$PWD/infra/xmtp-backend/config.toml:/config.toml:ro" \
  ghcr.io/xmtp/backend:8.0.0-rc4 --config-file /config.toml
```

Check health with a gRPC health client, for example `grpc-health-probe -addr=127.0.0.1:5050`. There is no HTTP health path.

## Secrets

| Variable | Where it lives | What it is |
|---|---|---|
| `XMTP_DATABASE_URL` | Backend | Postgres URL with `sslmode=verify-full` |
| `XMTP_JWKS_URL` | Backend | `https://ledgerchat.org/api/xmtp/jwks` |
| `XMTP_RPC_MAINNET` | Backend | Ethereum RPC, used only to verify smart-contract wallets |
| `XMTP_BACKEND_JWT_PRIVATE_JWK` | App server | ES256 private JWK with a `kid`. Generate it once and rotate it by adding a second key |
| `XMTP_BACKEND_SUB_PEPPER` | App server | 32 or more random bytes. Keeps the wallet out of the token |

Generate the signing key with:

```bash
node -e "import('jose').then(async j=>{const {privateKey}=await j.generateKeyPair('ES256',{extractable:true});const k=await j.exportJWK(privateKey);k.kid='hl-'+Date.now();console.log(JSON.stringify(k))})"
```
