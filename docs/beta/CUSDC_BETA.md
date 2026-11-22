# Closed technical beta of private cUSDC payments

Status: **built, switched off**. `cusdcBeta.enabled` is `false` in `deployments/aztec-mainnet.json`.

This is a closed technical test for at most 100 invited people. Its only purpose is to check that private cUSDC payments in the chat work end to end for real users. It is not a launch. The landing keeps saying "Not enabled yet" for USDC (`lib/landing/claims.ts`, row `usdc`), and nothing public changes while the beta runs.

## Decision on the gates (22 November 2026)

The operator decided to run this beta before the legal and company gates are met, and to deal with them in a later phase.

- **`CUSDC_GATES` are untouched.** All nine stay `met: false` (`lib/payments/assets.ts`). `cusdcReady()` stays `false`, so the wallet keeps hiding cUSDC from everyone who is not in the beta.
- **The beta is a separate path** (`lib/beta/cusdc-beta.ts`). It never reads or changes the gates.

### Still pending, deferred by the operator

| Gate | What it needs | Status |
| --- | --- | --- |
| `legal` | Written legal note: non-custodial software, not a CASP for cUSDC payments | Not met |
| `entity` | The operating company exists; its terms and privacy policy cover real payments | Not met |
| `onchain` | The cUSDC address confirmed on the Aztec v6 node by the read-only preflight | Not met. **The beta requires this one** (see below) |
| `alpha` | Closed alpha with HLC finished within its targets | Not met |
| `operator` | Stefan signs the switch-on, with a cap per payment | Not met. **The beta requires a cap** (see below) |
| `issuerWrittenClassification` | Written answer from human.tech on MiCA classification, issuer and 1:1 redemption | Not met |
| `legalNoteNotCasp` | Counsel: the integration does not make the company a CASP or a payment service provider | Not met |
| `sanctionsPolicy` | Policy on users from sanctioned countries, and how it is applied | Not met. The beta keeps the alpha's per-person check (see below) |
| `insurance` | Professional liability and cyber insurance | Not met |

## What the beta still requires (technical safety, not legal)

A wallet sees and sends cUSDC only when all of these hold. Each is checked by `cusdcBetaDecision`, on the server and in the client:

1. **`cusdcBeta.enabled` is `true`.** Stefan changes it in a pull request.
2. **`cusdcBeta.until` is set and in the future.** A beta always has an end.
3. **The cUSDC contract is confirmed on the network.** `plannedTokens[cUSDC].verifiedOnChain` is `true`, set from a read-only preflight run. Without it, real money could go to a wrong contract.
4. **A cap per payment in cUSDC is configured** in `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS`.
5. **The wallet is an active member.** It redeemed an invitation, it was not revoked, and there are at most 100 members.
6. **The member confirmed the current beta notice** (`BETA_NOTICE`, version `cusdc-beta-notice-1`).

Two more protections already apply to every payment on Alpha:

- **Exits-only mode** (`lib/aztec/value-mode.ts`) stops new payments at once without a deploy.
- **The G3 token check** verifies the token's class on the node before the wallet uses it.

### What each person sees

| Visibility | When | What it means |
| --- | --- | --- |
| `send` | Every condition holds | cUSDC is listed and can be sent |
| `exits` | A member whose access was revoked, or a beta that was paused, ended or lost its cap | The balance stays visible and the person's own funds can still be moved, but new payments are refused |
| `hidden` | Not a member, or the contract was never confirmed | cUSDC is not listed |

Revoking someone never locks what they hold.

## Invitations

Invitations reuse the closed alpha's code format and hashing (`lib/alpha/invites.ts`): 16 Crockford characters, and only the HMAC with `ALPHA_INVITE_PEPPER` is stored. They are kept in their own tables, `CusdcBetaInvite` and `CusdcBetaMember` (migration `20261122150000_cusdc_beta`), and do not depend on the HLC distributor or the alpha terms.

Before creating a code, the operator runs the same two per-person checks as the alpha (`inviteChecksProblem`): the EU consolidated sanctions list (date and result; a match never gets a code) and age 18 or older. Only the result is stored.

```sh
node scripts/beta/cusdc-invites.mjs create --by 0xOPERATOR --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked --days 14
node scripts/beta/cusdc-invites.mjs list
node scripts/beta/cusdc-invites.mjs revoke-member 0xWALLET
node scripts/beta/cusdc-invites.mjs revoke-invite <id>
```

The script needs `DATABASE_URL`, `ALPHA_INVITE_PEPPER` and `ALPHA_ADMINS`, the same variables as the alpha. No new Railway variable is needed.

## API

- `GET /api/beta/cusdc/status` returns `open`, `reasons`, `member`, `active`, `access`, `accessReasons`, `visibility`, `capacity` and `notice`.
- `POST /api/beta/cusdc/status` with `{ notice: true, noticeVersion }` confirms the current notice.
- `POST /api/beta/cusdc/redeem` with `{ code, notice: true, noticeVersion }` joins the beta.

All three need a signed session. Redemption is rate limited and runs under a database lock.

## Switching it on (Stefan, in order)

1. Merge the beta pull requests. The migration runs at the next deploy.
2. Run the cUSDC preflight read-only and record `verifiedOnChain: true` with the run number, in a pull request.
3. Add the cUSDC slot to `NEXT_PUBLIC_AZTEC_TOKENS` and its cap to `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS` in Railway.
4. Create the invitations with the script.
5. In a pull request, set `cusdcBeta.enabled: true` and `until` to the end date.
6. To pause, set exits-only mode (`AZTEC_VALUE_MODE`) or `cusdcBeta.enabled: false`. Both keep exits working.

## Notice text

The notice states facts about the test. It is not legal terms and does not replace them; the legal texts of Ledger Chat are unchanged. Its text lives in `lib/beta/cusdc-beta.ts` (`BETA_NOTICE`). Changing a word changes `BETA_NOTICE_VERSION`, and every member confirms the new text again.
