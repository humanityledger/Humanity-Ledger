# Pending: needs the operator, the Aztec toolchain or counsel

Agents cannot close these from the repository. Each line says who closes it and how. Updated 13 November 2026.

| # | Item | Why it matters | Owner | How it is closed |
| --- | --- | --- | --- | --- |
| P-01 | XMTP local database key in plaintext `localStorage` (`lib/xmtp/client.ts:244-260`, finding F-01, critical) | Any script on the origin can read the key that encrypts the local message database | Stefan (decision), then agent | Choose the migration: derive the key from a wallet signature (HKDF, as the Aztec account secret) or wrap it with a non-extractable WebCrypto key in IndexedDB. Either way the existing local database must be re-encrypted or users get a new XMTP installation; decide which, then the agent implements it with a migration test |
| P-02 | Recompile and deploy PrivateEscrow, PaymentStream | Agreements stay refused on Alpha; no fee mechanism can exist without them | Stefan | `docs/CONTRACT_DEPLOY_CHECKLIST.md` §1–3 |
| P-03 | Deploy LedgerSponsor, set `NEXT_PUBLIC_AZTEC_SPONSOR` | New accounts need about 28 AZTEC of Fee Juice before their first transaction | Stefan | Checklist §4 |
| P-04 | Provider keys in `NEXT_PUBLIC_*` (Pimlico, Alchemy, CoinGecko, 1inch, MoonPay, NewsAPI, PeerJS; F-07) | Reusable by anyone from the browser bundle | Stefan | Restrict each key to ledgerchat.org in the provider console and rotate; then an agent moves paid calls behind server routes |
| P-05 | `// @ts-nocheck` on `NativeCryptoSendModal.tsx`, `SendTipModal.tsx`, `app/api/aztec/account/route.ts` (F-08) | Type errors in value-moving code are invisible to CI | Agent, reviewed by Stefan | Remove the suppression one file at a time and fix the types (a separate pull request per file) |
| P-06 | Phase 0 fee mechanism in the escrow contract | Launch condition 1 and 2 for HLC (`docs/TOKENOMICS.md`) | Stefan with the Aztec toolchain; external audit | Add the fee note to `deposit` (ceiling division, minimum, private note to the treasury), test, recompile, testnet, audit |
| P-07 | Fix HLC supply on-chain | Launch condition 3: today the admin can grant minting rights | Stefan | Final mint to the allocation multisig, revoke every minter, set the admin to an address nobody controls; `/protocol` shows the result |
| P-08 | Legal opinion (MiCA / ESMA) and white paper | Launch condition 4; the fair launch is an offer to the public | Stefan with counsel | Opinion on classification; white paper notified to the competent authority before any offer |
| P-09 | Company behind the token name | The on-chain name is "Humanity Ledger Corp." while `lib/constants/legalEntity.ts` records an individual | Stefan with counsel | Incorporate before launch, then update `LEGAL_ENTITY` (kind `company`) |
| P-10 | Public and legal texts on Alpha (readiness R2) | `lib/docs/pages/legal.ts` still describes a test-network-only wallet | Stefan with counsel | Agents do not edit legal text |
| P-11 | External audit | No claim of audited contracts may be made | Stefan | Engage an auditor; report into `audits/` and `deployments/aztec-mainnet.json` → `audit` |
| P-12 | Read the sponsor's Fee Juice balance on `/protocol` | Shown as "not read" once a sponsor is recorded | Agent | Derive the public balance slot (poseidon2 of the map slot and owner) and read it through `node_getPublicStorageAt`, with a test vector from the Aztec sources |
| P-13 | Dependency chain `pm2` → `basic-ftp` (5 moderate) | Not exploitable here (`audits/README.md`) | Agent with network access | Upgrade pm2 or add an override and regenerate `package-lock.json` |
