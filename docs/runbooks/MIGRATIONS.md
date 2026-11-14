# Database migrations after a deploy

Since #88 the server starts even when `scripts/railway-pre-deploy.js` could not resolve a migration. Nothing is forced or deleted; the problem is reported in two places:

1. The deploy log, in lines that start with `[pre-deploy]`.
2. `GET /api/health`: `degraded` contains `migrations`, and `services.migrations.failed` names each failed migration.

## After every deploy

```bash
curl -s https://ledgerchat.org/api/health | jq '.degraded, .services.migrations'
```

`[]` and `"status": "OK"` mean there is nothing to do.

## When a migration needs a person

The `[pre-deploy]` line says which objects of that migration exist and which are missing.

| What the database shows | Command (Railway shell, or locally with `DATABASE_URL` of the direct database) |
|---|---|
| Every object of the migration exists | `npx prisma migrate resolve --applied <migration_name>` |
| None of them exists | `npx prisma migrate resolve --rolled-back <migration_name>`, then redeploy |
| Some exist, some do not | Apply the missing part by hand (from `prisma/migrations/<name>/migration.sql`), then `--applied` |

Then check `/api/health` again. A migration that replaces an older one is listed in `prisma/superseded-migrations.json` with the sha256 of its file and is resolved automatically.

## Variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | The pooled connection the app uses |
| `DATABASE_URL_UNPOOLED` | The direct connection, `${{Postgres.DATABASE_URL}}` in Railway; migrations need it (R9 in `docs/MAINNET_READINESS.md`) |
