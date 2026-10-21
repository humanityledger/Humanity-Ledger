# Runbook: Redis

**Owner**: On-call engineer  
**Last updated**: October 2025

---

## 1. Redis Down

### Symptoms
- Rate limiting not working (fail-open)
- Sessions not validated (if Redis stores sessions)
- SSE events not delivered (pub/sub broken)
- `/api/health` reports Redis unhealthy

### Steps

1. Check Railway Redis service status
2. Restart Railway Redis if crashed
3. Verify `REDIS_URL` environment variable is correct
4. Check Redis persistence settings (AOF or RDB should be enabled)

### Impact
- Rate limiters fail open (no rate limiting — abuse risk)
- SIWE nonces not validated (replay attack risk during outage)
- SSE not delivered to users on other replicas

---

## 2. Redis Memory Full

### Symptoms
- `OOM command not allowed when used memory > maxmemory`

### Steps

1. Check memory: `INFO memory` → `used_memory_human`
2. Check for keys without TTL: `SCAN 0 COUNT 1000` → inspect expiry
3. Force eviction: ensure `maxmemory-policy allkeys-lru` is set
4. All Humanity Ledger keys MUST have TTL — see `docs/db/redis-keys.md`

---

## 3. Redis Key Inventory

All keys must have TTL. See `docs/db/redis-keys.md` for the full list.

---

## 4. Credentials Rotation

When rotating Redis credentials (see `docs/runbooks/secrets.md`):
1. Update `REDIS_URL` in Railway environment variables
2. Deploy (connections will reconnect)
3. Verify old URL no longer connects
