# Runbook: Database Storage Capacity & Growth Alert

## Thresholds
- **Warning**: Database disk usage >= 75%
- **Critical**: Database disk usage >= 85%

## Remediation Procedure
1. Inspect table breakdown: `SELECT pg_size_pretty(pg_total_relation_size(relid)), relname FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;`
2. Vacuum and reindex bloat: `VACUUM ANALYZE;`
3. Archive historical audit logs older than 30 days to cold object storage.
4. Scale storage volume vertically on Railway dashboard with 1 click.
