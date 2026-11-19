# Master plan: prompts 1 to 4 as one project

A session starts here, then reads only the section of `docs/plan/prompts/` that its PR needs.

**Order of authority** (00-master.md §2):
1. Safety and truth rules.
2. Stefan's signed decisions (`docs/alpha/OPERATOR_DECISIONS.md`).
3. `00-master.md`.
4. Prompts 01 to 04.

## PRs

Update only your own row after each PR. Status values: `todo`, `open`, `merged`, `blocked`.

| # | PR | From | Depends on | Gate | Status | Branch | PR | Date |
|---|---|---|---|---|---|---|---|---|
| 0 | This plan and the four prompts in the repository | Master | — | — | merged | claude/master-plan | #162 | 2026-11-18 |
| 1 | Settings in Safari: portal and WebKit test | P1 · T1 | — | Test green on Mac, iPhone and iPad | open | claude/settings-safari | #164 | 2026-11-19 |
| 2 | Remove the Aztec wordmark from /chat | P1 · T2 | — | ui-shots green | merged | claude/chat-no-aztec-wordmark | #163 | 2026-11-18 |
| 3 | Phase 0: cause of the lost messages, hourly delivery test, truthful delivery indicator | P3 · F0 | — | Cause written down with logs; hourly test active | blocked: needs the `[delivery]` logs from Railway and two test accounts (Stefan) | | | |
| 4 | Foundations: `lib/facts.ts`, `tokens.css`, shared Playwright config, claims test, scale test, link checker | Master | 1 | Four required checks green, no visible change | todo | | | |
| 5 | Landing: system, scenes and details | P1 · T3 | 4 | Coherence audit resolved, with screenshots | open | claude/landing-polish | #167 | 2026-11-19 |
| 6 | Flawless landing render | P2 · A | 5 | Frame test and visual regression green | todo | | | |
| 7 | `/docs/on-aztec` and the "On Aztec Alpha" scene | P2 · B + P4 | 4, 5 | All 15 points, each with its source | todo | | | |
| 8 | Docs: system and templates | P4 · 1 | 4 | Every footer page uses the template | todo | | | |
| 9 | Docs: content | P4 · 2 | 8 | Inventory resolved, no 404 links | todo | | | |
| 10 | Mermaid diagrams | P4 · 3 | 8 | 14 SVGs with a sync test | todo | | | |
| 11 | Scale, phase 1 | P3 · F1 | 3 | k6 at 10× in a test environment | todo | | | |
| 12 | Scale, phase 2: realtime and the chat split into parts | P3 · F2 | 11 | −80 % requests per user | todo | | | |
| 13 | Trust and safety, and growth behind the `growth` switch | P3 | 3, 11 | Phase 0 gate met | todo | | | |
| 14 | Scale, phase 3, and the launch plan | P3 · F3 | 12 | D-day checklist complete | todo | | | |

**Ownership.** Two open PRs never touch the same file:
- `LedgerChatV2.tsx` is changed only in PRs 3, 12 and 13, one at a time.
- `LedgerSettingsFull.tsx` is changed only in PR 1.

## Decisions (00-master.md §3)

1. **One source of facts: `lib/facts.ts`.**
   - Every version, chain id, alpha cap, the first payment, class ids and addresses come from there.
   - It reads them from `deployments/*.json`, the config and `docs/alpha/`.
   - Nothing is written twice.
2. **One design system: `styles/tokens.css`.** The landing, the docs, the Mermaid theme and the Open Graph images all use it. A test fails on any value outside the scale.
3. **One Aztec page: `/docs/on-aztec`.** `/alpha` redirects there, and the landing scene "On Aztec Alpha" summarises it.
4. **One test toolchain:** Playwright on Chromium and WebKit, with its config in `e2e/` and one CI job per kind.
5. **CSP and the static page.** The landing is rendered per request for the CSP nonce (PR #159 and #160). The CSP is not weakened. The options are hashes of the inline scripts, or keeping it dynamic with CDN caching; the choice is made by measuring TTFB in both cases.
6. **Brands.**
   - Only the official Aztec and Ethereum marks, unaltered.
   - No independence sentence. No "partner", "official" or "backed by".
   - The /chat wordmark is removed.
7. **Growth behind a switch.** `growth` stays off until the phase 0 gate is met and Stefan approves.

## Conflicts noted (resolved by the order of authority, or waiting for Stefan)

- **Progress line and pulsing live dot.** Prompt 1 asks for a 2 px violet progress line and a dot that pulses every 2 s. On 18/11/2026, in the chat, Stefan asked for **no blue line and no pulsing dots** on the landing, and both were removed (PRs #159 and #160). They stay removed until Stefan says otherwise.
- **Stickers and GIFs.** Prompt 1 lists them among the messaging bubbles in "Say hi". Stefan asked that the *closing* phone not show stickers, and it shows a payment request. Stickers inside the chat bubbles are a separate question for Stefan.
- **Static landing.** See decision 5.
- **Calls scene.** It shows an image Stefan supplied, not a Ledger Chat screen. Its source and licence must be confirmed (`public/media/landing/README.md`). Prompt 1 asks for the LivePhone in video. Stefan chooses.

## Stefan's tasks (00-master.md §7)

- [ ] Merge each PR, in the order of the table, once its four required checks are green.
- [ ] **Required checks.** `Contract Tests (Hardhat)` only runs when a PR touches `contracts/`, `test/` or `app/api/`. Either remove it from the required checks in the ruleset, or ask for it to run on every PR.
- [ ] **Railway.** Turn on replicas, a second region and a Postgres replica when the scale phase asks for them, and put the CDN in front following the guide.
- [ ] **Delivery tests.** Create two test accounts and store their keys as GitHub secrets. Send the `[delivery]` logs from Railway (PR #155) for phase 0.
- [ ] **Texts to approve.** Alpha risks and migration; Security (response times, PGP, bounties if any); About; Contact; Brand; translations; the launch plan.
- [ ] **With the lawyer.** The visitor counter, the DSA for communities, rewards, the name, and the proposed changes to `legal.ts`.
- [ ] **Aztec ecosystem directory.** Ask for Ledger Chat to be listed.
- [ ] **`GITHUB_TRAFFIC_TOKEN`.** Add it in Railway to show repository clones on the globe.
- [x] Close PR #161: it is superseded by #160 (closed 19/11/2026).
- [ ] Check Settings on a real iPhone, iPad and Mac in Safari once #164 is deployed (headless WebKit at iPad size runs no animation frames, so that case is tapped with force in the test).
