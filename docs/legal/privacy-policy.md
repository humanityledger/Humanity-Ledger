# Privacy policy (draft for the closed alpha)

Estado: internal draft, not in force until counsel signs (OD-8) · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: the texts in force are the pages under /docs (`lib/docs/pages/legal.ts`)

> Draft prepared with Claude, pending review by a qualified lawyer. It replaces the earlier version, which named a data protection officer and an external consultancy that do not exist.

The alpha privacy text proposed for counsel is `docs/legal/drafts/ANEXO_II_privacidad_alpha.md` (Spanish). This file keeps the same facts in English for the repository.

## Who is responsible

Stefan Antonio Cirisanu, a private individual, until the S.L. exists. There is no data protection officer. The privacy contact is the one in the legal notice (`/docs/legal-notice`).

## What we cannot see

Direct and group messages are end-to-end encrypted with MLS on your device and travel through the XMTP network. Your Aztec payment keys are derived in your browser from a signature of your wallet; we never hold them. Each payment is proved and signed on your device. The network hides its amount and parties; the account that pays the network fee is visible on Alpha.

## What we process and why

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


Community posts are **not** end-to-end encrypted. They are stored on our server and can be read by the community's members and by us.

## Who else is involved

- Railway (United States) hosts the app and its database as a processor. The transfer basis and the hosting region are pending (D-6).
- The XMTP network carries encrypted messages and sees technical metadata such as addresses and times.
- Aztec and Ethereum are public ledgers nobody controls. What is written there cannot be erased.
- Authorities, only when a law or a valid order requires it (`docs/legal/law-enforcement.md`).

We do not sell data or use it for advertising.

## Your rights

Access, rectification, erasure, objection, restriction and portability, through the privacy contact, answered within one month. Erasure cannot reach what is recorded on Aztec or Ethereum. You can complain to the Agencia Española de Protección de Datos (aepd.es).

## Minors

The closed alpha is for people aged 18 or over.
