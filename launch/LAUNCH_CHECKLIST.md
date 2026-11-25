# Launch checklist

Branch `launch/1000-stars`. Every phase of both launch briefs (the seven-phase launch brief and the seven-phase Aztec alignment brief) is merged into this one branch and one pull request.

## 1. Files in this branch

| Phase | File | Change |
|---|---|---|
| 1 Truth | `docs/TRUTH_AUDIT.md` | New: 16 discrepancies, 13 fixed here, 3 left for the operator |
| 1 Truth | `SECURITY.md` | Rewritten: current scope, retired circuits removed, verified tests only |
| 1 Truth | `docs/STATUS.md`, `audits/README.md`, `docs/RUN-LOCAL.md` | Stale audit wording; compose password |
| 1 Aztec | `docs/AZTEC_ALIGNMENT_AUDIT.md` | New: 15 aligned practices, 8 deviations with exact corrections, 3 questions for Aztec Labs |
| 2 README | `README.md` | Rewritten as a short introduction |
| 2 README | `docs/EVALUATION_DOSSIER.md` | The former README, unchanged except relative links |
| 2 README | `docs/audit/START_HERE.md`, `docs/TRACEABILITY_MATRIX.md`, `docs/readme/FACTS.md`, `docs/readme/IMAGES_TODO.md` | References repointed to the dossier |
| 3 Visuals | `assets/launch/` | Payment GIF and strip (real capture), architecture SVG and PNG, social preview, shot list and embedding guide |
| 4 Trust | `docs/TRUST.md` | New: one page on state, protections, what is public, limits |
| 4 Trust | `app/not-found.tsx`, `lib/i18n/messages/{es,de,ru,zh}.json` | 404 text "The sovereign path…" replaced by "This page does not exist." in five languages |
| 4 CI | `lib/prisma.ts`, `app/api/chat/send/route.ts` | The two TypeScript errors that fail type-check on `main` (TS2322, TS2403) |
| 4 Aztec | `docs/AZTEC.md` | New: the integration as reference |
| 5 Onboarding | `docs/QUICKSTART.md` | One screen: use it, run it (Node 22, compose password), verify |
| 6 Launch | `launch/x-thread.md`, `launch/x-variants.md`, `launch/linkedin.md`, `launch/sequence.md`, `launch/objections.md` | Ready to paste; every X post under 280 characters |
| 7 | `launch/LAUNCH_CHECKLIST.md` | This file |

No file under `contracts/aztec/` and no wallet code changed: an external audit began on 25 November 2026, and contract changes would move class IDs away from the audited code.

## 2. Before T0

- [ ] Merge the PR.
- [ ] Social preview: Settings → General → Social preview → upload `assets/launch/social-preview.png`.
- [ ] Description, website and topics (current description is "Ledger Chat "):

```bash
gh api -X PATCH repos/humanityledger/humanity-ledger \
  -f description="End-to-end encrypted messaging with private payments in the conversation. XMTP (MLS) for messages, Aztec for payments, proofs made in the browser." \
  -f homepage="https://ledgerchat.org"
gh api -X PUT repos/humanityledger/humanity-ledger/topics \
  -f "names[]=aztec" -f "names[]=xmtp" -f "names[]=zero-knowledge" -f "names[]=privacy" \
  -f "names[]=messaging" -f "names[]=end-to-end-encryption" -f "names[]=mls" -f "names[]=noir" \
  -f "names[]=ethereum" -f "names[]=payments" -f "names[]=zk" -f "names[]=web3"
```

- [ ] Optional, strong: record `chat-to-payment.gif` and the two videos (`assets/launch/README.md`) and paste the video link under the `DEMO VIDEO` comment in the README.
- [ ] Check the link preview of the repository URL in an X draft and a LinkedIn draft.
- [ ] Re-render or withdraw the brand mockups that say "fee sponsored" (`docs/TRUTH_AUDIT.md`, T-16): a reply could screenshot them.

## 3. Minute by minute

See [`sequence.md`](sequence.md). Recommended T0: **Tuesday 1 December 2026, 14:00 UTC (15:00 Madrid)**, not during US Thanksgiving week.

| Offset | Action |
|---|---|
| T0 | X post 1 with `social-preview.png` |
| +2 min | X posts 2 to 11 |
| +5 min | Reply with the repo link; pin post 1 |
| +20 min | Personal messages to 15 to 25 relevant engineers, asking for review |
| +30 min | LinkedIn long post; links in first comment |
| +0 to 3 h | Answer every reply within 15 minutes (`objections.md`) |
| +4 h, +8 h | X standalone posts 2 and 1 |
| +19 h | LinkedIn medium |
| +20 h, +26 h, +30 h | X standalone posts 3, 4, 5 |
| +24 h | Quote-post with what you learned, if true |
| +32 h | LinkedIn short |

## 4. What to watch

```bash
# stars now
gh api repos/humanityledger/humanity-ledger --jq .stargazers_count
# views and unique visitors, last 14 days (needs push access)
gh api repos/humanityledger/humanity-ledger/traffic/views --jq '.count, .uniques'
# where visitors come from
gh api repos/humanityledger/humanity-ledger/traffic/popular/referrers --jq '.[] | [.referrer, .count, .uniques] | @tsv'
```

| Metric | Where | Healthy sign |
|---|---|---|
| Stars per hour | command above, every 2 h | Rising for the first 6 h, then a second bump with Day 2 posts |
| Unique visitors → stars | Traffic API | 5 % or more of unique visitors star |
| Referrers | Traffic API | `t.co` and `linkedin.com` both present |
| Thread impressions, link clicks | X analytics | Post 1 clicks rising after the repo reply |
| Replies with technical questions | X, LinkedIn | Turn each good one into an issue |
| Beta requests | the beta inbox | Count per hour |

Fill in at T0 + 10 h, + 24 h, + 48 h:

| | +10 h | +24 h | +48 h |
|---|---|---|---|
| Stars | | | |
| Unique visitors | | | |
| X impressions (thread) | | | |
| LinkedIn impressions | | | |
| Issues opened by others | | | |
| Beta requests | | | |

## 5. Plan B

| If at T0 + 6 h | Do |
|---|---|
| Thread under 5,000 impressions | Post variant C of the first post (`x-variants.md`) as a fresh post at the next 14:00 UTC; do not delete the first thread |
| Visitors arrive but under 3 % star | Move the star line higher in the README and make sure the GIF loads; check the link preview image |
| A credible criticism gains traction | Reply with the fix or the issue link within the hour; post the fix as its own update when merged |
| Almost no clicks from LinkedIn | Re-post the medium version from your profile with the video or the GIF, link in the first comment |
| Stars plateau after 24 h | Extend the plan to seven days: one technical post per day (G7, fees, contracts, honesty check, architecture), each with its own image |

What not to do under pressure: buy stars, join star-for-star groups, use second accounts, or tag Aztec Labs or XMTP Labs as if they endorsed the project.

## 6. Expectations

From 14 stars, 1,000 in 48 hours would be far above what most new open-source projects reach from social posts alone; it usually takes a large account sharing the work. This kit maximises the chance that people who arrive star the repository and that engineers who matter can verify every claim. Count the result honestly, and keep the plan running for a week.

## 7. Checks that were run on this branch

| Check | Result |
|---|---|
| `node scripts/check-forbidden-copy.mjs` | Pass |
| `node scripts/forbidden-patterns.mjs` | Pass |
| Relative links in every new or changed Markdown file | 0 broken |
| Dictionaries still valid JSON after the 404 change | Pass |
| X posts ≤ 280 characters (links as 23) | Pass |
| Personal-name check of `advanced-hardening.yml` | No new hits from this branch; it already fails on `main` (contract comments, i18n files, `LICENSE-MIT`, `TRADEMARKS.md` and others are outside its allow-list) |
| Type check, tests, Lighthouse, `npm audit` | Not runnable here (no `node_modules`, no package network). CI decides. On `main` at `fdbefcb4`, type check fails on the two errors fixed here; `npm audit` fails on a high-severity advisory that needs a dependency update |
