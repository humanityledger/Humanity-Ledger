# International Data Transfers
# Standard Contractual Clauses (SCCs)

**Last updated**: October 2025

---

## Overview

Humanity Ledger processes personal data of EEA/UK residents and transfers it to processors based in the United States. Per GDPR Chapter V, we rely on the **Standard Contractual Clauses (SCCs)** approved by the European Commission (Decision 2021/914).

---

## Transfers and Legal Basis

| Processor | Location | Data transferred | SCC Type | Status |
|-----------|----------|-----------------|----------|--------|
| Railway (Brex Inc.) | US (East) | User profiles, community posts, session tokens, logs | Module 2 (Controller → Processor) | Required |
| LiveKit Inc. | US | Call metadata (no message content) | Module 2 | Required |
| XMTP Labs | US | Message delivery metadata (no content — E2EE) | Module 2 | Required |
| Apple (APNs) | US | Push tokens (no message content) | Module 2 | Required |
| Google (FCM) | US | Push tokens (no message content) | Module 2 | Required |

---

## Privacy Notice

Users are informed of international transfers in the Privacy Policy (Section 8). The transfers are necessary to perform the service users signed up for.

---

## Action Items

- [ ] Execute SCCs with Railway
- [ ] Execute SCCs with LiveKit  
- [ ] Execute SCCs with XMTP Labs
- [ ] Review Apple and Google Data Processing Addendums
- [ ] Add transfer map to ROPA (docs/legal/ropa.md)

---

## UK Addendum

For UK residents, we rely on the UK IDTA (International Data Transfer Agreement) in addition to or instead of EU SCCs where required by the UK ICO.
