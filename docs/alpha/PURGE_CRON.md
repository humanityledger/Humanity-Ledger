# Daily purge of admission data (Railway cron)

`scripts/alpha/purge.mjs` clears the personal admission fields once `retainUntil` has passed. That date is 6 months after `closedAlpha.until`. The script is idempotent and exits when it is done. It is rehearsed in CI by `.github/workflows/alpha-invites-rehearsal.yml`.

Stefan does these steps once, in Railway. The agent does not change Railway.

1. In the project, create a **new service** from the same GitHub repository. Name it `alpha-purge`.
2. In that service's settings, set the **config file path** to `/railway.purge.toml`.
   - This file runs `node scripts/alpha/purge.mjs` every day at 03:17 UTC.
   - It has no health check and is never restarted.
   - The web service keeps `railway.toml`.
3. Set two variables on `alpha-purge`: `DATABASE_URL=${{Postgres.DATABASE_URL}}` and `DATABASE_URL_UNPOOLED=${{Postgres.DATABASE_URL}}`. Both are direct, not PgBouncer, because the schema names both. It needs no other secret.
4. Deploy it once. In its log, expect one of these lines:
   - `Cleared 0 invitation(s) and 0 tester(s).`
   - `Due: …` when run with `--dry-run`.
5. Check the next day that a run appears at 03:17 UTC.

If Railway does not show a config file path setting, set the start command and the cron schedule in the service settings to the same values as `railway.purge.toml`. Leave the health check empty.

**Before the alpha ends:** `closedAlpha.until` must be set. Without it, `retainUntil` is null and nothing is ever purged. Leaving it null is the safe failure: nothing is deleted early.
