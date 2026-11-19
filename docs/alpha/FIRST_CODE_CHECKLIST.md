# First invitation code: checklist

Every line must be true before `node scripts/alpha/invites.mjs create` runs for the first tester.

1. Counsel has decided who distributes HLC, and `closedAlpha.distributor` is recorded in a PR merged by Stefan.
2. The terms are signed and published per `TERMS_PUBLISHING.md`, and `/api/alpha/status` shows the hash.
3. `/api/health` shows `latestApplied` at or after `20261119150000_fee_juice_grants`, and `degraded` is empty.
4. The HLC token on Alpha carries the test name and symbol: the preflight is green and `renamePending` is false.
5. `closedAlpha.enabled` is true and `closedAlpha.until` is set, in Stefan's PR.
6. `ALPHA_INVITE_PEPPER` (32+ characters) and `ALPHA_ADMINS` are set on the web service.
7. `ALPHA_FEE_JUICE_BUDGET` is set, and the first Fee Juice grant can be recorded at `/api/alpha/fee-juice-grants`.
8. The `alpha-purge` cron service has run once (`PURGE_CRON.md`).
9. For this tester: the EU consolidated sanctions list is checked (date noted, result clear), and age 18+ is checked.
10. `[payment]` and `[delivery]` lines appear in the web log for a test send between two operator accounts.
