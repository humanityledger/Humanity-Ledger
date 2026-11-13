# Audits: inventory

**State on 13 November 2026: no external audit of any Humanity Ledger contract or circuit has concluded.**
`deployments/aztec-mainnet.json` records `"audit": null`, and the client keeps the "unaudited" acknowledgement and
per-payment caps on Aztec Alpha until a report is recorded there (`lib/aztec/agreement-policy.ts`).

Because no audit exists, no audited contract hash can be compared with `deployments/`. When a report arrives it is
stored here as `audits/<date>-<firm>-<scope>.pdf` with the commit and the class IDs it covers, and its path and
date are recorded in `deployments/aztec-mainnet.json` (`audit`).

## Documents that carry security evidence

| Document | What it is | State |
| --- | --- | --- |
| `docs/AZTEC_AUDIT_MANIFEST.md` | What was checked in our code against the Aztec v6.0.0 sources, with corrections to earlier internal claims | Current (10 Nov 2026), internal |
| `docs/AUDIT_SCOPE.md` | Scope for an external reviewer | Current, preparation |
| `docs/zk/audit-request.md` | Circuit and contract audit request specification | Preparation, not a finding |
| `docs/audit/JANUARY_2027_AUDIT_DOSSIER.md` | Prospective preparation dossier | Preparation, states it records no completed findings |
| `docs/AUDIT_DOSSIER.md` | Internal residual risk register | Internal, not an external audit |
| `docs/security/dangerous-inner-html-audit.md` | Review of `dangerouslySetInnerHTML` uses | Internal |
| `docs/security/FINDINGS_2026-11-13.md` | Repository sweep of 13 Nov 2026 (secrets, storage, simulations, env, dependencies) | Current, internal |
| `test/unit/security/audit-2026-*.test.ts` | Regression tests for earlier internal findings | Run in CI |
| `audits/archive/2026-11-09-npm-audit-results.md` | Earlier dependency report | **Archived: out of date.** It said high and critical findings were remediated with nothing open; CI on 13 Nov 2026 reports 5 moderate (below) |

## Dependencies (npm audit, CI run on `main` at 68f3659, 13 Nov 2026)

0 critical, 0 high, 5 moderate, all in one chain pulled by `pm2` 7.0.0–7.0.4 (direct dependency):
`basic-ftp` ≤ 6.2.3 ← `get-uri` ← `pac-proxy-agent` ← `proxy-agent` ← `pm2`.

Exploitability here: the vulnerable code runs only when pm2 resolves a proxy auto-config or FTP URL. The
`ledger-monitor` process configures no proxy, so an attacker would first need to control pm2's environment.
Not exploitable in this deployment; fix by upgrading pm2 once a release depends on a patched `proxy-agent`, or with an
`overrides` entry for `basic-ftp` regenerated in `package-lock.json` (needs network access; not done by `npm audit fix --force`).
