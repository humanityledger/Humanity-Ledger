# Runbook: Secret Rotation

**Owner**: Security lead  
**Frequency**: Quarterly (or immediately after any security incident)  
**Last rotation**: October 2025

---

## Secrets Inventory

| Secret | Environment Variable | Purpose | Rotation Procedure |
|--------|---------------------|---------|-------------------|
| JWT signing key | `JWT_SECRET` | Session tokens | Rotate → redeploy → old sessions invalidated |
| PIN pepper | `ENCLAVE_PIN_PEPPER` | Argon2id pepper for PIN | Rotate → users must re-enter PIN once |
| PIN secret | `ENCLAVE_PIN_SECRET` | PIN HMAC fallback | Rotate with pepper |
| Redis credentials | `REDIS_URL` | Redis connection | Rotate in Railway → redeploy |
| Database credentials | `DATABASE_URL` | PostgreSQL | Rotate in Railway → redeploy |
| LiveKit API key | `LIVEKIT_API_KEY` | Call tokens | Rotate in LiveKit console → redeploy |
| LiveKit API secret | `LIVEKIT_API_SECRET` | Call tokens | Same as above |
| TURN credentials | `NEXT_PUBLIC_TURN_URLS` | WebRTC TURN | Rotate HMAC key in Coturn → redeploy |
| Gitleaks license | `GITLEAKS_LICENSE` | CI secrets scanning | Renew annually |

---

## Rotation Procedure

1. **Generate new secret**: `openssl rand -base64 48`
2. **Update Railway environment variable** (do NOT commit to git)
3. **Deploy** with zero-downtime rolling restart
4. **Verify** the old secret no longer works (test a request with old JWT — should 401)
5. **Document** rotation date in this file

---

## One Secret Per Purpose

Each secret has exactly ONE purpose. Never:
- Use `DATABASE_URL` to derive other keys
- Reuse `JWT_SECRET` for PIN operations
- Share TURN credentials between environments

---

## After a Security Incident

If a secret may have been compromised:
1. Rotate IMMEDIATELY (do not wait for the quarterly cycle)
2. Invalidate all sessions: clear `hl_session` cookie validity
3. Document in postmortem (see `docs/postmortems/template.md`)
4. Notify affected users if required (see `docs/legal/breach.md`)
