# NLnet proposal draft: Ledger Chat

**Status:** draft for the NLnet call closing on 3 January 2027 at 12:00 CET. Not submitted. Every figure below points to a file, a CI workflow or a testnet transaction in this repository; before submitting, re-check each one against `main`.

## Project name

Ledger Chat: private messaging with private conditional payments, on XMTP and Aztec

## Applicant

Stefan Antonio Cirisanu, trading as Humanity Ledger (an individual, not a company), Spain. GitHub organisation: `humanityledger`. Contact: humanityledger@icloud.com.

## Requested amount

EUR 40,000, for about 290 hours of development (about EUR 138 per hour), over six months.

## Abstract

Ledger Chat is an open-source messenger in which two people can pay each other, hold money in escrow, or stream a payment over time, without our server, network observers or a block explorer learning the amount or the parties of a private transfer. Messages use XMTP v3, which implements the IETF MLS protocol (RFC 9420); we use XMTP's implementation and do not implement MLS ourselves. Payments run as private transactions on Aztec, a zero-knowledge rollup on Ethereum, and are proved in the user's browser. Conditional payments are three contracts we wrote in aztec-nr (Aztec's Noir framework): an escrow, a payment stream and a credential check. They run today on Aztec's test network with test tokens that have no value. This project turns them from tested contracts into features people can use inside a conversation, and prepares them for an external security review.

## The problem

When people coordinate and pay each other on public blockchains, the payment is public: the amount, both addresses and, by linking payments, a large part of each person's social and financial graph. Chat applications that add crypto payments usually inherit this. The message may be encrypted, but the payment it arranges is published for anyone to analyse, permanently.

Aztec makes private state and private transfers available to applications, but an application still has to do the work: write contracts whose rules hold without anyone seeing the balances, manage the keys of contracts that hold private funds, and let two people set up and settle an agreement from inside their conversation without a server in the middle. That work is what Ledger Chat does, and it is not finished. Aztec itself is in its alpha phase; we target its test network and will follow its path to mainnet.

## What exists today

All of this can be checked without our help.

| Component | State | How to check it |
| --- | --- | --- |
| Direct messages | XMTP v3 (MLS, RFC 9420), browser SDK 5.2.0 | `lib/xmtp/` |
| Private payments in the chat | Shield, private transfer and unshield on Aztec testnet with the standard Token contract and the Sponsored FPC; test tokens zkUSDC, zkDAI, zkETH. Shield and unshield are public; private transfers hide amount and parties | `scripts/aztec/e2e-testnet.mjs`, `docs/AZTEC_FOUNDATION_DOSSIER.md` |
| `PrivateEscrow`, `PaymentStream`, `IdentityCredential` (aztec-nr v6.0.0) | 55 TXE tests pass in CI (escrow 13, identity 20, streams 22) | Workflow "Aztec contracts"; `contracts/aztec/*/src/test.nr` |
| Escrow and stream on testnet | Keyed instances (one per agreement), run end to end: escrow claim, escrow refund after the deadline, stream withdrawal bounded by accrual, sender cancel; identity claim against a real depth-32 root, a claim within a replaced root's grace period, issuer rotation; an escrow opened, accepted and confirmed against the contract's stored note through the client library; both parties reading stored terms (`escrow_view`, `stream_view`); an identity root built by the issuer library for three members | Workflow "Aztec escrow e2e (testnet)"; transaction hashes in `docs/AZTEC_TESTNET_DEPLOYMENTS.md` |
| Deployment record | Every recorded instance is checked daily against the testnet node: instance present, class equal to the committed artifact, keys present when required | `deployments/aztec-testnet.json`, workflow "Aztec testnet deployments" |
| Application test suite | 1,338 tests pass in CI; they mock external services (database, Redis, RPC) where needed | `npm run test:run`, workflow "Security & Compliance" |
| Licence | MIT OR Apache-2.0 | `LICENSE-MIT`, `LICENSE-APACHE` |
| External audit | None yet | `docs/AZTEC_FOUNDATION_DOSSIER.md`, section 6 |

We also publish what is wrong or missing, including our own mistakes. On 4 November 2026 the first escrow and stream instances were deployed without contract keys, so deposits into them could never have been spent. We found it by checking the deployment against the node, marked both addresses do-not-use, fixed the deployment script and redeployed with keys. The review notes for the contracts (`docs/zk/AZTEC_CONTRACTS_REVIEW.md`) list every finding with its fix.

## What this grant would fund

| # | Deliverable | How NLnet can verify it | Hours |
| --- | --- | --- | --- |
| D-1 | Agreements inside the chat. The library exists and runs on testnet: one keyed instance per agreement, an invitation the receiver verifies before registering the contract (address recomputed from the shared secret, class from the deployment record, accepted token, conversation peer), confirmation of the deposit against the contract's stored note (`escrow_view`, `stream_view`), and the peer's Aztec address pinned per XMTP inbox (`lib/aztec/agreements.ts`, `agreement-invite.ts`, `peer-binding.ts`). This deliverable puts it in the conversation: sending and receiving invitations as XMTP messages, agreement status, claim, refund, withdraw and cancel from the chat, and a signature by the Aztec account over the XMTP inbox so the pinned address is proven, not only announced | Recorded two-account demo on testnet, with the transaction hashes; tests for `lib/aztec/agreement-invite.ts` | 90 |
| D-2 | Credential issuance. The tree library exists (`lib/aztec/credential-tree.ts`: depth-32 root and member paths with the contract's hashes, checked against the deployed contract by the testnet e2e). This deliverable adds the issuer tool around it (collecting members' commitments, publishing the root, delivering each member's path and salt privately) and a multisig issuer; two-step rotation and a root grace period exist since 5 Nov 2026 | A testnet run issuing credentials to several members and each claiming | 60 |
| D-3 | Community channels as MLS groups: posts move from server-readable storage to XMTP MLS groups, so the server stores only ciphertext | Integration test against XMTP's network; migration notes in `docs/communities/MLS_MIGRATION.md` | 60 |
| D-4 | Contract hardening for review: call the token through its typed interface instead of a raw function selector, once the dependency can be added without duplicating the `aztec` crate; property tests for the accrual and settlement invariants | TXE tests; a clean dependency graph in `Nargo.toml` | 40 |
| D-5 | Audit-ready package: threat model, invariants per contract, a guide that lets a stranger reproduce every claim in under 30 minutes, and preparation for an external security review | The guide itself, followed by someone outside the project | 40 |
| | **Total** | | **290** |

We would welcome the security review and other support services that NLnet's partners offer to funded projects.

## Timeline

| Month (2027) | Work |
| --- | --- |
| January | D-1 invitation flow and contract registration in the client |
| February | D-1 in-conversation status and actions; two-account demo |
| March | D-2 issuer tool and key rotation |
| April | D-3 community channels on MLS groups |
| May | D-4 hardening |
| June | D-5 audit-ready package; buffer |

## Comparison with existing work

Signal and other end-to-end encrypted messengers protect message content; Signal offers payments in MobileCoin, without escrow or conditional payments. XMTP provides encrypted messaging for wallet addresses, without private payments. Aztec wallets provide private transfers, without a conversation or conditional payment logic. Ledger Chat combines these, building on existing standards and implementations (MLS through XMTP, aztec-nr contracts, Aztec's client-side proving) rather than on cryptography of our own.

## Technical challenges

- **Keys of contracts that hold private funds.** A contract that custodies private notes needs its own keys, and whoever holds them can read every note of that instance. We use one instance per agreement, shared only by its two parties; the invitation has to be verified before anyone deposits.
- **Time in private execution.** Private functions see the timestamp of a past block. Every deadline therefore bounds the transaction's expiration as well, and the stream cancel limits how stale its anchor block may be (at most 600 seconds of accrual can be withheld).
- **Cancel without seeing the other party's state.** The sender cannot see the recipient's withdrawals. Each stream state has a nullifier shared by withdraw and cancel, and withdrawals hand the sender a copy of the next state.
- **Following Aztec's releases.** Aztec is in alpha. The contracts are pinned to aztec-nr v6.0.0, and the CI compiles and tests them on every change.

## Ecosystem

The work is useful beyond our application: reviewed aztec-nr patterns for escrow, streams and scoped credentials; a verified invitation format for keyed contract instances; and a public, automated way to check that deployed instances match their source. We share questions and findings with the Aztec community in its forum and Discord, and every result is in the repository.

## Risks

| Risk | Mitigation |
| --- | --- |
| Aztec testnet changes or resets | Contract logic is tested in TXE on every change; testnet runs are reproducible from scratch with throwaway accounts |
| One developer | All code, tests and receipts are public, and D-5 is a guide for someone else to take over |
| XMTP SDK changes | Version pinned (browser SDK 5.2.0); upgrades are separate, tested changes |
| Aztec major version changes | Contracts are separate Nargo packages with their own tests; the deployment record keeps old instances verifiable |

## Why open source

Privacy infrastructure has to be auditable to be trusted: a private messenger or payment contract that nobody can inspect asks users to take its claims on faith. The code is dual-licensed MIT OR Apache-2.0, so anyone can audit, fork or build on it, and each claim we make is backed by something a reader can run.

## Before submitting

- [ ] Re-check every count and hash against `main` on the day of submission.
- [ ] Confirm the form's questions and limits on https://nlnet.nl/propose/.
- [ ] Confirm the hourly rate and the hours with your own estimate.
- [ ] Make sure the public site works; today it returns 404.
