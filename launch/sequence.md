# 48-hour publishing sequence (X and LinkedIn only)

## When to start

**Recommended T0: Tuesday 1 December 2026, 14:00 UTC (15:00 Madrid, 09:00 New York).** Thursday 26 November is Thanksgiving in the United States and Friday is Black Friday: a large share of the developer audience on X is offline until Monday. Tuesday to Thursday, 13:00 to 16:00 UTC, reaches Europe's afternoon and America's morning at once.

If you start earlier anyway, keep the same order and offsets from your own T0.

## Before T0 (allow one hour)

1. Merge the PR so the README on `main` is the new one.
2. Upload `assets/launch/social-preview.png` as the repository's social preview (Settings → General → Social preview).
3. Set description, website and topics (command in [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md)).
4. Paste a test link to the repository into an X draft and a LinkedIn draft to confirm the preview card shows the new image.
5. Write a list of 15 to 25 people who would genuinely want to read this code: engineers who build on Aztec or XMTP, privacy researchers, people who reviewed it before. You will message them personally at T+20 min.

## Day 1

| Time | Channel | Action | File |
|---|---|---|---|
| T0 | X | Post 1 of the thread, with `social-preview.png` | `x-thread.md` |
| T0 + 2 min | X | Posts 2 to 11 as replies, with their images | `x-thread.md` |
| T0 + 5 min | X | Reply to post 1 with the repository link; pin post 1 to your profile | `x-thread.md` |
| T0 + 20 min | Direct messages | Send each person on your list a personal note with the thread link. Ask for a review or an honest reaction, not for a star or a repost | — |
| T0 + 30 min | LinkedIn | Long post (English), links in the first comment | `linkedin.md` |
| T0 + 35 min | LinkedIn | Long post (Spanish) only if your network is mostly Spanish-speaking; otherwise skip | `linkedin.md` |
| T0 to T0 + 3 h | X and LinkedIn | Answer every reply within 15 minutes; use the prepared answers | `objections.md` |
| T0 + 4 h | X | Standalone post 2 ("What's on chain"), with the strip image | `x-variants.md` |
| T0 + 8 h | X | Standalone post 1 (G7, for engineers) | `x-variants.md` |
| T0 + 10 h | Both | Note the numbers in the checklist table | `LAUNCH_CHECKLIST.md` |

## Day 2

| Time | Channel | Action | File |
|---|---|---|---|
| T0 + 19 h (09:00 Madrid) | LinkedIn | Medium post, different image (`architecture.png`) | `linkedin.md` |
| T0 + 20 h | X | Standalone post 3 (the honesty check) | `x-variants.md` |
| T0 + 24 h | X | Quote-post your own post 1 with what you learned from the replies: a fix you made, a question you got. Only if it is true | — |
| T0 + 26 h | X | Standalone post 4 (fees) | `x-variants.md` |
| T0 + 30 h | X | Standalone post 5 (status) | `x-variants.md` |
| T0 + 32 h | LinkedIn | Short post | `linkedin.md` |
| T0 + 34 h to T0 + 48 h | Both | Answer replies, turn good questions into issues and link them back | — |

## Rules that protect the account and the project

* No bought stars, follow-for-follow or star-for-star groups, bots or second accounts. GitHub removes such stars and can flag the repository; for a privacy project, being caught once costs more than any number of stars.
* Do not tag Aztec Labs, the Aztec Foundation or XMTP Labs as if they endorsed this. Naming the networks you build on is fine.
* Never post a star count as proof of quality. Post what the code does.
* If someone finds a real problem, thank them in public, open an issue, and link the fix when it lands.
