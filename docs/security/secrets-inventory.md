# Cryptographic Secrets Inventory

| Secret Environment Variable | Purpose | Derivation Rule |
|---|---|---|
| `JWT_SECRET` | Signing `hl_session` cookies | Independent 256-bit random hex |
| `PIN_PEPPER` | Hashing screen-lock PINs | Independent 256-bit random hex |
| `LIVEKIT_API_SECRET` | LiveKit WebRTC call tokens | Issued by LiveKit dashboard |
| `TURN_SECRET` | Ephemeral TURN credentials | Independent secret |
| `REDIS_URL` | Redis cache and pub/sub connection | Managed database connection string |
| `DATABASE_URL` | PostgreSQL transactional store | Managed database connection string |

No secret is derived from another secret or from DATABASE_URL.
