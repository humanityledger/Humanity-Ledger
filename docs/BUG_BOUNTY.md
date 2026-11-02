# Coordinated Vulnerability Disclosure Policy

> **Protocol Standard:** HL-CVD-2026.1  
> **Classification:** Public Security Advisory and Vulnerability Reporting Protocol  
> **Status:** Active — Non-Monetary Academic Disclosure Framework (Testnet Stage 1)  
> **Security Contact:** `humanityledger@icloud.com`

---

## 1. Disclosure Framework and Scope

Humanity Ledger maintains an academic Coordinated Vulnerability Disclosure program. The protocol is currently deployed in Testnet Stage 1 across Aztec Testnet and Ethereum testnets.

> [!IMPORTANT]
> **No Monetary Bounties Active:** Humanity Ledger does **not** offer cash rewards, token distributions, or financial compensation for vulnerability disclosures during Testnet Stage 1. All security research is evaluated under a non-monetary academic disclosure framework. Participating researchers receive formal attribution, public acknowledgment in GitHub Security Advisories, and inclusion in the protocol Security Hall of Fame. A funded monetary bounty program is scheduled for deployment upon completion of external security audits and protocol mainnet capitalization.

---

## 2. In-Scope Technical Components

Security researchers are invited to inspect and analyze the following monorepo components:

| Monorepo Path | Domain | Description |
|---|---|---|
| `circuits/escrow/` | Noir Circuit | Escrow release constraint satisfaction and nullifier derivation |
| `circuits/identity/` | Noir Circuit | Membership proofs and anonymous sanction screening constraints |
| `circuits/streams/` | Noir Circuit | Temporal monotonicity and continuous stream accrual constraints |
| `contracts/HumanityTimeLockVault.sol` | Smart Contract | Non-custodial vault timelock mechanisms and balance conservation |
| `contracts/HumanityIdentityRegistry.sol` | Smart Contract | Identity state binding and ownership preservation |
| `contracts/security/LedgerDeadmanSwitch.sol` | Smart Contract | Dead man switch threshold logic and backup transfer controls |
| `lib/aztec/verifier.ts` | Protocol | Verification key lifecycle transitions and hash verification |
| `lib/security/eaf-guard.ts` | Runtime | Ephemeral application sandbox egress prevention and payload bounds |
| `lib/security/constant-time.ts` | Cryptography | Timing invariant preservation and side-channel elimination |
| `lib/security/zeroize.ts` | Memory | Ephemeral buffer wiping and secret destruction |

---

## 3. Out-of-Scope Domains

The following vectors are outside the protocol research scope:

1. Distributed denial of service attacks that generate traffic volume without demonstrating logic flaws.
2. Social engineering or phishing directed at protocol contributors or administrators.
3. Attacks requiring physical possession of user devices with root privileges.
4. Vulnerabilities in upstream third-party dependencies not introduced by this codebase.
5. Theoretical quantum cryptanalysis against classical primitives (BN254, secp256k1, Curve25519), which are acknowledged non-claims under current protocol constraints.

---

## 4. Reporting Protocol and Service Level Commitments

Researchers who identify potential security vulnerabilities should submit their findings privately:

- **Transmission Channel:** Encrypted submission to `humanityledger@icloud.com` or via GitHub Private Security Advisories.
- **Initial Acknowledgment:** Within 12 hours of report transmission.
- **Technical Triage:** Formal reproduction and severity determination within 24 hours.
- **Remediation SLA:** 
  - Critical Severity: Resolution within 5 business days.
  - High Severity: Resolution within 7 business days.
  - Medium / Low Severity: Resolution within 30 business days.

---

## 5. Security Hall of Fame and Attribution

Valid vulnerability disclosures will receive:
1. Public attribution in the official GitHub Security Advisory.
2. Permanent citation in `docs/AUDIT_DOSSIER.md` (Security Hall of Fame).
3. Inclusion in protocol release notes.
4. Documented eligibility for retroactive recognition upon the deployment of the mainnet capitalized incentive pool.

---

## 6. Safe Harbor Agreement

Humanity Ledger will not initiate legal action against security researchers who:

1. Conduct research within the parameters of this policy.
2. Refrain from modifying, exfiltrating, or disrupting private state data.
3. Provide a coordinated disclosure window (minimum 30 days) prior to any public release.
4. Refrain from extortion, commercial exploitation, or unauthorized data dissemination.
