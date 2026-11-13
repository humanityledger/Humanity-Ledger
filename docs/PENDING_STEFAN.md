# Pending: needs the operator, the Aztec toolchain or counsel

Agents cannot close these from the repository. Each line says who closes it and how. Updated 13 November 2026.

| # | Item | Why it matters | Owner | How it is closed |
| --- | --- | --- | --- | --- |
| P-01 | ~~XMTP local database key in plaintext `localStorage`~~ | Closed on `feat/security-phase2`: derived from a wallet signature; legacy keys wrapped, not replaced | — | One extra signature per page load (and one phone approval on a linked computer); smart-contract wallets that do not return a 65-byte signature are refused with an explanation |
| P-02 | Recompile and deploy PrivateEscrow, PaymentStream | Agreements stay refused on Alpha; no fee mechanism can exist without them | Stefan | `docs/CONTRACT_DEPLOY_CHECKLIST.md` §1–3 |
| P-03 | Deploy LedgerSponsor, set `NEXT_PUBLIC_AZTEC_SPONSOR` | New accounts need about 28 AZTEC of Fee Juice before their first transaction | Stefan | Checklist §4 |
| P-04 | Provider keys moved to server variables (F-07) | Code reads `ALCHEMY_API_KEY`, `PIMLICO_API_KEY`, `COINGECKO_KEY`, `ONEINCH_API_KEY`, `NEWS_API_KEY` at run time; the `NEXT_PUBLIC_*` names are no longer read | Stefan | In Railway: add the five server variables, delete the `NEXT_PUBLIC_*` copies, rotate every key that was ever set under a public name, and restrict the PeerJS and MoonPay publishable keys to ledgerchat.org in their consoles |
| P-05 | ~~`@ts-nocheck` on value-moving code~~ | Closed on `feat/security-phase2` (F-08a–c) | — | `LedgerSettingsFull.tsx` keeps its suppression by project rule; `LedgerChatV2.tsx` still has one and moves value through its handlers: next candidate |
| P-06 | Phase 0 fee mechanism in the escrow contract | Launch condition 1 and 2 for HLC (`docs/TOKENOMICS.md`) | Stefan with the Aztec toolchain; external audit | Add the fee note to `deposit` (ceiling division, minimum, private note to the treasury), test, recompile, testnet, audit |
| P-07 | Fix HLC supply on-chain | Launch condition 3: today the admin can grant minting rights | Stefan | Final mint to the allocation multisig, revoke every minter, set the admin to an address nobody controls; `/protocol` shows the result |
| P-08 | Legal opinion (MiCA / ESMA) and white paper | Launch condition 4; the fair launch is an offer to the public | Stefan with counsel | Opinion on classification; white paper notified to the competent authority before any offer |
| P-09 | Company behind the token name | The on-chain name is "Humanity Ledger Corp." while `lib/constants/legalEntity.ts` records an individual | Stefan with counsel | Incorporate before launch, then update `LEGAL_ENTITY` (kind `company`) |
| P-10 | Public and legal texts on Alpha (readiness R2) | `lib/docs/pages/legal.ts` still describes a test-network-only wallet | Stefan with counsel | Agents do not edit legal text |
| P-11 | External audit | No claim of audited contracts may be made | Stefan | Engage an auditor; report into `audits/` and `deployments/aztec-mainnet.json` → `audit` |
| P-12 | Read the sponsor's Fee Juice balance on `/protocol` | Shown as "not read" once a sponsor is recorded | Agent | Derive the public balance slot (poseidon2 of the map slot and owner) and read it through `node_getPublicStorageAt`, with a test vector from the Aztec sources |
| P-13 | Dependency chain `pm2` → `basic-ftp` (5 moderate) | Not exploitable here (`audits/README.md`) | Agent with network access | Upgrade pm2 or add an override and regenerate `package-lock.json` |
