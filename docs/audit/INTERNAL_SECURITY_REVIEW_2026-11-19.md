# Internal security review 2: 19 November 2026 (package 7)

**What this is.** An internal review by the project's own engineering, done with an AI coding agent, by reading the code. Nobody outside the project checked it. It is not an audit, and `deployments/aztec-mainnet.json` keeps `"audit": null`.

- **Base:** `main` at `30fecda` (#192), plus the stack #193–#198.
- **Method:** reading the files named below, plus the repository's offline checks (`env-inventory`, `check-consistency`).
- **Not run here:** unit tests and `npm audit`, because this session has no registry access. Both run in CI (`ci.yml` and `security.yml`, which blocks HIGH and CRITICAL).

## Scope

The scope covers these files and areas:
- `/api/alpha/redeem`;
- `/api/alpha/fee-juice-grants` and `lib/alpha/fee-juice-grants.ts`;
- `/alpha`;
- the session ending in `scripts/railway-pre-deploy.js` and `lib/db/migrate-lock.js`;
- `lib/activities` and `components/activities`;
- the CSP in `middleware.ts`;
- the closed alpha gate (`lib/alpha/gate.ts`) and where it is applied;
- the new report and status endpoints from packages 3 and 6;
- the threat model.

## Findings

| Id | Severity | Finding | Status |
| --- | --- | --- | --- |
| R2-1 | **High** (before the gate opens) | `closedAlphaDecision` (enabled, until, class, recorded deployment, active member, risk acknowledgement) was not called by any opening path. Once a class was recorded in `contracts`, `checkAgreementPolicy` alone would have let any account with HLC open agreements, whether or not it was a member and whatever `enabled` and `until` said. Found in the incident drill (package 6). | **Fixed.** `GET /api/alpha/gate` decides on the server with the caller's membership, and `openChatAgreement` asks it before the deploy and again before funding. It fails closed. Accepting and the exits never ask. |
| R2-2 | Low | Redemption counted members and created one in a Read Committed transaction. Two codes redeemed together at 49 members could both pass the 50 cap. | **Fixed.** `pg_advisory_xact_lock(72707370)` at the start of the redemption transaction. |
| R2-3 | Low | A Fee Juice grant read the total spent and then inserted. Two grants recorded together could pass the budget, and a hash recorded twice gave a 500. | **Fixed.** The budget is checked again under `pg_advisory_xact_lock(72707371)` in the insert's transaction. A duplicate hash returns 409. |
| R2-4 | Medium | The grants CSV escaped quotes but not formulas. A `value_source` starting with `=`, `+`, `-` or `@` would run in the tax adviser's spreadsheet. | **Fixed.** Such cells are prefixed with `'`. |
| R2-5 | Low | The pre-deploy matched Prisma's lock by `objid` only. A two-key advisory lock of another client with that second key would have matched and could have been ended. | **Fixed.** It now matches `classid = 0` and `objsubid = 1`, which is how a single-bigint lock appears. |
| R2-6 | Info | The CSP allows `connect-src https: wss:` and `frame-src https:`. With a nonce-only `script-src` and `object-src 'none'` this does not enable script injection, but it does not limit where an injected script could send data. | Accepted for now. Wallet, RPC and relay endpoints vary by user. Narrowing it is listed for the external review package. |
| R2-7 | Low (functional) | `/alpha` hashed the terms after decoding them to text, which drops a UTF-8 BOM. A signed file with a BOM would never match `sha256sum`, so redemption would fail closed. | **Fixed.** It hashes the bytes served. |
| R2-8 | Info | The gate is enforced by the app, not by the contracts, which have no allowlist (no owner, by design). A modified client could still open an agreement of a recorded class. | Accepted. It is bounded by `MAX_AMOUNT` of 100 HLC in the contract, by HLC going only to members, and by the value-mode switch. |
| R2-9 | Info | The payment and delivery reports are self-reported, so a signed-in account can inflate counts. | Accepted. A limit per wallet (30 or 20 a minute) applies. The worst outcome is a false alert, with no data exposure. |
| R2-10 | Info | Grants are admin-reported. The lookup confirms that the transaction succeeded, not its recipient or amount. | Accepted. Only admins record grants, and the CSV says the amounts are as recorded. Check against the explorer before filing. |

`lib/activities` and `components/activities` have no network calls and no HTML sinks. Their only storage read is validated against an allowlist.

## Not covered

- The Noir contracts beyond package 4's tests: no new review of the circuits or of the PXE.
- XMTP and MLS.
- The bridge contracts, which are not deployed.
- Dependency behaviour beyond `npm audit`.

These go to the external review package (`EXTERNAL_REVIEW_PACKAGE.md`).
