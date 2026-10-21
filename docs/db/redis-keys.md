# Redis Key Architecture & TTL Reference

| Key Pattern | TTL | Purpose |
|---|---|---|
| `siwe:nonce:{nonce}` | 600s (10m) | Ephemeral SIWE challenge nonce |
| `rl:{ip}:{action}` | 60s (1m) | Sliding window rate limit counter |
| `session:refresh:{familyId}` | 2,592,000s (30d) | Refresh token family and reuse detection |
| `presence:{wallet}` | 60s (1m) | Realtime online heartbeat |
| `events:stream` | Pub/Sub | Multi-replica Server-Sent Events broker |
