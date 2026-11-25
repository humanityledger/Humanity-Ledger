# Truth audit, 26 November 2026

Every public claim in `README.md`, `SECURITY.md`, `docs/QUICKSTART.md`, `docs/RUN-LOCAL.md`, `docs/STATUS.md` and `audits/README.md` was checked against the code, configuration and deployment records on branch `launch/1000-stars` (base `main` at `fdbefcb4`). A claim stays only if a file in this repository supports it. `node scripts/check-forbidden-copy.mjs` and `node scripts/forbidden-patterns.mjs` pass before and after.

## Ground truth used

| Fact | Source |
|---|---|
| External audit began 25 Nov 2026, no report; `audit` is `null` | `deployments/aztec-mainnet.json`, `docs/audit/START_HERE.md` |
| Closed cUSDC beta: at most 100 members, single-use codes, 23 Nov 2026 to 23 Feb 2027 | `lib/beta/cusdc-beta.ts` (lines 14 and 75), `docs/beta/CUSDC_BETA.md` |
| No direct payment on Alpha above 100 cUSDC (`ALPHA_MAX_AMOUNT`, 100,000,000 base units) | `lib/protocol/fees.ts` line 139 |
| Network: Aztec 6.0.0 "Tierra" (Alpha V6), settles on Ethereum mainnet | `deployments/aztec-mainnet.json` (`network`) |
| SDK: `@aztec-labs/*` 6.0.0, `@xmtp/browser-sdk` 5.2.0, aztec-nr `v6.0.0` from `aztec-labs-eng/aztec-nr` | `package.json`, `contracts/aztec/*/Nargo.toml` |
| Our only contract on Alpha is the HLC test token; escrow, streams, portal and fee contracts are not deployed | `deployments/aztec-mainnet.json`, `docs/STATUS.md` |
| Node 22 or newer, enforced | `package.json` `engines`, `.npmrc` `engine-strict=true` |

Two invitation programmes exist and are not the same thing: the **closed alpha** for escrow and streams with HLC (OD-4, at most 50 testers after the 19 Nov amendment, `docs/alpha/DEPLOY_RUNBOOK.md`) and the **closed cUSDC beta** for private payments in chat (at most 100, code above). New public copy refers only to the cUSDC beta. `docs/alpha/OPERATOR_DECISIONS.md` line 37 still shows the original OD-4 value of 20; the amendment is recorded elsewhere. Left for the operator, who signs that file.

## Discrepancies and corrections

| ID | Where | What it said | What is true | Action |
|---|---|---|---|---|
| T-01 | `docs/STATUS.md` line 11 | "An external audit begins today." | A relative date goes stale the next day. | Now "began on 25 November 2026". **Fixed.** |
| T-02 | `audits/README.md` line 3 | State on 13 Nov 2026, no mention of the audit that began | Audit began 25 Nov 2026, no report | Header updated to 26 Nov 2026. **Fixed.** |
| T-03 | `SECURITY.md` §3, §4, invariant 5, two threat rows, RISK-03/04/06 | VK state machine in `lib/aztec/verifier.ts`, `test/vk_hash_mismatch.test.ts`, `circuits/CONSTRAINT_COMPLETENESS.md`, 14-day VK timelock | None of those files exist since the standalone circuits were retired to `archive/standalone-circuits/` on 25 Nov 2026; the VK registry was never deployed | `SECURITY.md` rewritten around the product as it is. **Fixed.** |
| T-04 | `SECURITY.md` threat matrix | TURN relay "masks peer IP addresses" | Relay is forced only when "Hide my IP address" is on (`components/terminal/LedgerChatV2.tsx` line 2337) | Stated as an option. **Fixed.** |
| T-05 | `SECURITY.md` §6 | "EDGE MIDDLEWARE (Vercel Edge)" | Deployed on Railway (`railway.toml`) | Hosting claim removed. **Fixed.** |
| T-06 | `SECURITY.md` threat matrix | "proof of humanity screening" against Sybil flooding | No such check in `middleware.ts` or `lib/` | Removed. **Fixed.** |
| T-07 | `SECURITY.md` threat matrix | "90 requests per minute per verified wallet" | `middleware.ts` line 451 sets 900 (360 through the relay) per key; the window is not stated there | Figure removed. **Fixed.** |
| T-08 | `SECURITY.md` §8 | "Testnet Stage 1", "pre-mainnet status", "Security Hall of Fame" | The product runs on Aztec Alpha with real value; no hall of fame exists in the repository | Reworded: no bounties during the closed beta, credit in the advisory. **Fixed.** |
| T-09 | `docs/QUICKSTART.md` | Node.js v20 or higher | `engines.node >=22.0.0` with `engine-strict=true`: `npm ci` refuses Node 20 | Node 22. **Fixed.** |
| T-10 | `docs/QUICKSTART.md`, `docs/RUN-LOCAL.md` | `docker compose up` with no password; RUN-LOCAL says the password is `postgres` | `docker-compose.yml` requires `POSTGRES_PASSWORD` and has no default | Commands now set it. **Fixed.** |
| T-11 | `docs/QUICKSTART.md` | "1,338 tests in CI on 4 Nov 2026", "43 Hardhat tests" | Counts from 4 Nov; the suites changed since (circuits retired 25 Nov) | Counts removed. **Fixed.** |
| T-12 | `README.md` first image | The hero was the HLC test-token record ("HLC deployed in block 28,992") | HLC is a test token with no value and is no longer listed by the wallet on Alpha | README now opens with the product; the record stays in the dossier. **Fixed.** |
| T-13 | `README.md` | 616 lines, eleven caveats before the first heading | Accurate but unreadable for a first visit | Full text moved unchanged to [`docs/EVALUATION_DOSSIER.md`](EVALUATION_DOSSIER.md); references in `docs/audit/START_HERE.md`, `docs/TRACEABILITY_MATRIX.md`, `docs/readme/FACTS.md` repointed. Every caveat that changes a decision is kept in the new README's status box. **Fixed.** |
| T-14 | `docker-compose.yml` | `aztecprotocol/aztec-sandbox:6.0.0-rc.1` | Every other pin is 6.0.0 final | Not changed: the published tag for 6.0.0 under the new `@aztec-labs` scope was not verifiable from here. Listed as A-07 in [`AZTEC_ALIGNMENT_AUDIT.md`](AZTEC_ALIGNMENT_AUDIT.md). |
| T-15 | `docs/alpha/OPERATOR_DECISIONS.md` line 37 | OD-4 "At most 20" | Amended to 50 on 19 Nov 2026 (`docs/alpha/DEPLOY_RUNBOOK.md` line 57, `docs/GLOSSARY.md`) | Operator-signed file: not edited. **For Stefan.** |
| T-16 | `public/brand/ledger-chat/ledger-chat-iphone-payment.png` and `ledger-chat-chats.png`, shown on the `/docs` brand page (`lib/docs/pages/brand.ts`) | The iPhone mockup reads "Proving on this iPhone · fee sponsored" inside an iOS Dynamic Island; the desktop mockup lists "shipping the sponsor build"; both show HLC amounts (48 HLC, a 1,245 HLC balance) | Ledger Chat sponsors no fee (decision of 15 Nov 2026, `test/unit/aztec/no-sponsorship.test.ts`); a web app cannot draw in the Dynamic Island; proving on a physical iPhone is not recorded (`docs/STATUS.md`, dashboard delta); HLC has no value and is not listed on Alpha | Image files: not edited here. New launch assets do not use them. **For Stefan:** re-render without "fee sponsored", without the Dynamic Island, and with a cUSDC amount, or withdraw them from the brand page. |

## Claims the new copy does not make

No star counts, user counts, partnerships, endorsements, audit results, "production" or "mainnet launch" wording, and no comparison with other projects. "Try it" points to the beta request form at `/beta`, because `/chat` opens only for beta members while the beta runs (`docs/EVALUATION_DOSSIER.md` §3).

## How to re-run

```bash
node scripts/check-forbidden-copy.mjs
node scripts/forbidden-patterns.mjs
python3 - <<'PY'
import re, os
for f in ["README.md","SECURITY.md","docs/TRUST.md","docs/AZTEC.md","docs/QUICKSTART.md","docs/EVALUATION_DOSSIER.md"]:
    s = open(f).read(); b = os.path.dirname(f)
    for t in re.findall(r'\]\(([^)\s#]+)', s):
        if not re.match(r'^(https?:|mailto:|/)', t) and not os.path.exists(os.path.normpath(os.path.join(b, t))):
            print(f, "missing", t)
PY
```
