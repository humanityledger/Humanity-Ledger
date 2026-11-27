# Ledger Chat on Aztec — ecosystem post (draft)

Status: draft for Stefan to post on forum.aztec.network. It is not an announcement by Aztec Labs and implies no relationship with them. Every claim below points to code or to a record in this repository. `docs/aztec/FORUM_DRAFT_2026-11-19.md` (the questions post) is unchanged and stays the reference for the questions.

**Title:** Ledger Chat: private communities and payments on Aztec Alpha — what is shipped, what is waiting, and ten open questions

---

## What Ledger Chat is

A messaging app where private conversations and communities are end-to-end encrypted (XMTP, MLS), and where payments between people go through a wallet that runs on the person's device on Aztec Alpha (6.0.0 "Tierra"). Proofs are made in the browser; our server never holds keys, balances or who paid whom.

## What is shipped (and where to check it)

| Area | What works | Evidence |
|---|---|---|
| Communities | Each channel is its own MLS group with every member; owners and admins keep membership in step with the server's member list; members who are online welcome people who joined while no admin was. | `lib/communities/mls.ts`, `lib/xmtp/groups.ts`, `test/unit/xmtp/group-send.test.ts` |
| Community apps | Members describe a tool and a model writes it, or start from seven templates (poll, sign-up, shared list, scheduling, padel league, expense split, idea board). Apps run in a sandbox with an opaque origin, no network and no frames; their data is per community, written through a narrow bridge. | `lib/community-apps/framePolicy.ts`, `test/unit/security/frame-isolation.test.ts`, `lib/community-apps/templates.ts` |
| Governance | One member, one vote (For / Against / Abstain), quorum per proposal, roles shown. Votes are rows on our server, not on Aztec. | `app/api/chat/communities/[id]/proposals/route.ts`, `lib/communities/governance.ts` |
| Wallet | The account pays its own Fee Juice on Alpha. The PrivateFPC route exists in code and is off by default (A-05). | `lib/aztec/fees.ts`, `lib/aztec/private-fees.ts`, `docs/AZTEC_ALIGNMENT_AUDIT.md` |
| Wallet interop | Ledger Chat's wallet is built in; wallets that speak `@aztec-labs/wallet-sdk` (for example browser extensions) can be discovered from the wallet panel. Discovery connects nothing. | `lib/aztec/wallet/external-sdk.ts` |

## What is not shipped, on purpose

- **No community treasury contract** is deployed on Alpha or on the test network. The treasury panel says so and shows no balance. A community can draft a treasury proposal and vote on it; nothing is paid from it.
- **Our contracts have no external audit report yet.** An external review started on 25 November 2026. `deployments/aztec-mainnet.json` keeps `"audit": null` until a signed report is committed, and the Alpha gate for agreements stays closed.
- **cUSDC in agreements** waits for A-02: the AIP-20 token has `transfer_private_to_private`, not `transfer_in_private`, so escrows and payment streams cannot hold it until a reviewed contract update.
- **Identity credentials** such as ZKPassport are described as an interface only (`lib/aztec/zkpassport.ts`); no verifier is configured and none is trusted.
- **Private swaps** are not built into Ledger Chat. The wallet links to Nemi, a separate exchange listed in Aztec's ecosystem directory, and reads balances again when the person comes back.

## The ten questions

The full context, our interim decisions and the repository evidence for each are in `docs/AZTEC_DECISIONS.md`. All ten are open.

1. **Q1 — Shared settlement nullifier.** Is `H(escrow_id, settlement_tag)` from both `claim` and `refund`, with the timestamp checks, an idiomatic way to say "claim before the deadline, refund after it"?
2. **Q2 — Keyed deployment as a custody pattern.** Is deploying an escrow instance keyed to the parties a sound custody pattern on Alpha?
3. **Q3 — Raw selector vs. Token interface.** Should a contract call a token by raw selector, or depend on the Token interface?
4. **Q4 — Stream cancel nullifier.** Is a shared per-state nullifier the right way to make cancel and settle exclusive?
5. **Q5 — Time bounds in private functions.** How should time-dependent values be bounded in private functions (we cap expiry at `min(deadline, anchor + 3600)`)?
6. **Q6 — Gas padding.** Is padding simulated gas the recommended strategy, and by how much?
7. **Q7 — Sponsored FPC on Alpha.** Will a sponsored FPC be available on Alpha, and on what terms?
8. **Q8 — Fee privacy on Alpha.** What is the recommended path to a private fee payer (A-05)?
9. **Q9 — Peer key control (G7).** How should an app verify that a peer controls the Aztec key it presents?
10. **Q10 — Note discovery for offline recipients.** For a token without a private transfer event (A-06), should wallets rely on note discovery and balance deltas?

## How to reply

Answers in this thread are recorded in `docs/AZTEC_DECISIONS.md` under each question, with the date. If any of our interim decisions is wrong, we change the code and say so here.
