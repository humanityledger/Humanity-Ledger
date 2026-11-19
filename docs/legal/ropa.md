# Records of processing activities (art. 30 GDPR)

Estado: internal draft, not in force until counsel signs (OD-8) · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: the texts in force are the pages under /docs (`lib/docs/pages/legal.ts`)

> Draft prepared with Claude, pending review by a qualified lawyer. It replaces the earlier version, which named a data protection officer and an external consultancy that do not exist.

- **Controller:** Stefan Antonio Cirisanu, a private individual, until the S.L. exists (`lib/constants/legalEntity.ts`). "Humanity Ledger" is a trading name, not an entity.
- **Data protection officer:** none. A privacy contact is given in the legal notice.
- **Processors:** Railway (hosting and database, United States; data processing agreement and transfer basis pending). The XMTP network carries encrypted messages; whether node operators are processors, joint controllers or independent third parties is for counsel to decide.
- **Why this record is kept:** the exemption for fewer than 250 employees does not apply when processing is not occasional, and here it is not.

| Data | Purpose | Legal basis | Retention |
| --- | --- | --- | --- |
| Wallet address and session (SIWE) | Account access | Contract, art. 6(1)(b) | While the account exists |
| Username | Being found by others | Contract | While the account exists; released on deletion |
| Tester name and contact | Running the closed alpha | Tester agreement | 8 weeks of alpha + 6 months |
| Acceptance of the terms (time and text hash) and the operator's sanctions and age checks (result only) | Proving admission | To be confirmed by counsel | 6 months after the alpha ends (`scripts/alpha/purge.mjs`) |
| Community posts (server) | Community feature | Contract | Until the author or the community deletes them |
| Delivery reports with shortened ids | Diagnosing delivery | Legitimate interest, art. 6(1)(f); written balancing test pending | 30 days |
| Technical and security logs | Protecting the service | Legitimate interest | 90 days |
| Fee Juice grants to testers | Tax documentation | Legal obligation | Tax period, to be confirmed |
| Direct messages | Not processed: end-to-end encrypted with MLS on the device | — | — |

Anything written to Aztec or Ethereum cannot be erased. The design avoids writing identifying data on chain.
