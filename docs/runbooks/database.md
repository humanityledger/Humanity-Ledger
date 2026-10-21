# Runbook: Database

**Owner**: On-call engineer  
**Last updated**: October 2025

---

## 1. Database Down / Unreachable

### Symptoms
- `/api/health` returns 503
- All authenticated API routes return 500
- Railway dashboard shows Postgres service as crashed

### Steps

1. **Check Railway status**: railway.app → your project → Postgres service → Logs
2. **Check connection limit**: `SHOW max_connections;` via Railway query tool
3. **Restart if needed**: Railway dashboard → Postgres → Restart
4. **Check for migration failure**: look for `prisma migrate` errors in deploy logs
5. **Roll back deploy** if crash occurred after a deployment (see `docs/runbooks/rollback.md`)

### Prevention
- `connection_limit=10&pool_timeout=20` appended to `DATABASE_URL`
- PgBouncer in transaction mode (see C-007)
- Daily backups (see `docs/runbooks/backup.md`)

---

## 2. Slow Queries

### Symptoms
- p95 > 1s on Railway metrics
- Specific routes timing out

### Steps

1. Enable `pgaudit` logging temporarily
2. Run `EXPLAIN ANALYZE` on the slow query
3. Check for missing indexes (see `docs/db/explain.md`)
4. Add index in a migration (do NOT use `--accept-data-loss`)

---

## 3. Migration Failure

### Steps

1. **Do NOT run** `prisma db push --accept-data-loss`
2. Check the migration error in Railway deploy logs
3. Fix the migration file locally
4. Test against a staging database
5. Restore from backup if data was corrupted (see `docs/runbooks/backup.md`)

---

## 4. Connection Pool Exhaustion

### Symptoms
- `Error: Connection pool timeout`
- All routes slow

### Steps

1. Check active connections: `SELECT count(*) FROM pg_stat_activity;`
2. Kill idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';`
3. Reduce `connection_limit` in `DATABASE_URL` if running multiple replicas
