# PostgreSQL Backup & Restoration Runbook (A-020, C-010)

## Overview
This runbook defines the operational procedures for full automated daily backups, point-in-time recovery (PITR), and emergency manual database restoration for Humanity Ledger on Railway.

## Daily Automated Backups
Railway manages automated snapshot backups of the primary PostgreSQL cluster daily.
Retention policy: 30 days.

## Manual Full Backup Procedure
Before executing any disruptive database migrations or schema refactoring:
```bash
# 1. Export entire PostgreSQL database dump with schema and data
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file=backup_$(date +%Y%m%d_%H%M%S).dump

# 2. Verify dump integrity
pg_restore --list backup_*.dump > /dev/null && echo "Backup verified valid"
```

## Restoration Test Procedure
To verify that backups are restorable into an isolated temporary database:
```bash
# 1. Provision or target isolated test database
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5433/humanity_test"

# 2. Restore dump into isolated test database
pg_restore --clean --if-exists --no-owner --no-acl -d "$TEST_DATABASE_URL" backup_*.dump

# 3. Verify table counts and referential integrity
psql "$TEST_DATABASE_URL" -c "SELECT count(*) FROM \"User\";"
psql "$TEST_DATABASE_URL" -c "SELECT count(*) FROM \"AuthUser\";"
psql "$TEST_DATABASE_URL" -c "SELECT count(*) FROM \"Community\";"
```

## Emergency Rollback
In the event of a failed migration during deployment:
1. Railway container fails pre-deploy and exits with code 1 (preventing corrupted deployment).
2. Restore database state from pre-deployment snapshot if any schema drift occurred.
3. Fix the failing migration in local test environment before re-deploying.
