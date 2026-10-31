# Humanity Ledger — Bug Bounty Program
**Version 1.0 — 2026-10-31**  
**Platform**: Immunefi (pending publication after external audit completion)  
**Status**: DRAFT — Not yet live. Activates after external audit gate (see `docs/AUDIT_SCOPE.md` §6).

---

## 1. Program Overview

The Humanity Ledger Bug Bounty Program rewards security researchers who responsibly disclose vulnerabilities in the protocol's cryptographic components, smart contracts, and application infrastructure.

**Maximum Reward**: $50,000 USD (Critical)  
**Minimum Reward**: $500 USD (Low)

> [!IMPORTANT]
> This program is **not yet live**. Responsible disclosures before the Immunefi publication date should be sent directly to the protocol team via the contact method in Section 7.

---

## 2. Scope

### 2.1 In-Scope Assets

| Asset | Category | Max Reward |
|---|---|---|
| `circuits/escrow/` — Noir ZK circuit | Circuit Soundness | $50,000 |
| `circuits/streams/` — Noir ZK circuit | Circuit Soundness | $50,000 |
| `circuits/identity/` — Noir ZK circuit | Circuit Soundness | $50,000 |
| `contracts/HumanityTimeLockVault.sol` | Smart Contract | $50,000 |
| `contracts/HumanityIdentityRegistry.sol` | Smart Contract | $30,000 |
| `contracts/security/LedgerDeadmanSwitch.sol` | Smart Contract | $30,000 |
| EAF bridge (`lib/security/eaf-guard.ts`) | Application | $10,000 |
| Aztec PXE key flow (`lib/aztec/`) | Application | $10,000 |
| VK anchoring and timelock bypass | Protocol | $50,000 |
| MLS epoch advance and PCS | Protocol | $20,000 |

### 2.2 Out-of-Scope

The following are explicitly **not** in scope:

- Third-party services: XMTP, WalletConnect, Clerk, Railway infrastructure
- Transport-layer attacks (IP tracking, timing analysis)
- Social engineering attacks against team members
- Denial of Service (DoS) against the application server
- Known issues listed in `docs/AUDIT_DOSSIER.md` RISK-01 to RISK-05
- Issues in dependencies not directly controlled by this protocol (report to upstream)
- Quantum attacks (not in threat model)

---

## 3. Severity Classifications

### CRITICAL — Up to $50,000

A vulnerability that directly enables:
- **Circuit soundness break**: Producing a valid ZK proof for a false statement (e.g., spending funds the attacker does not own)
- **VK bypass**: Registering a malicious verification key without the 14-day timelock
- **Nullifier collision**: Bypassing double-spend prevention without knowing the secret
- **L1 fund drain**: Extracting user funds from `HumanityTimeLockVault` without authorization
- **Timelock bypass**: Executing a queued operation before `executeAfter` timestamp

### HIGH — Up to $20,000

- **Server private key exposure**: Extracting Aztec wallet keys or Schnorr signing keys from server side (would violate P1)
- **EAF escape**: Sandboxed EAF iframe making unauthorized network requests
- **MLS PCS failure**: Compromised epoch key persisting after device removal
- **Identity spoofing**: Creating valid identity proofs for an address the attacker does not control
- **VK mismatch detection failure**: Client accepting a proof verified under a wrong VK

### MEDIUM — Up to $5,000

- **Canary bypass**: Accessing server-side canary key without triggering detection
- **Rate limit bypass**: Submitting ZK proofs at unlimited rate without restriction
- **Session fixation/hijacking**: Persistent session after Clerk session revocation
- **CSP violation enabling data exfiltration** (not DoS)
- **Storage compartmentalization failure**: One EAF app reading another app's state

### LOW — Up to $500

- **Information disclosure**: Leaking non-sensitive metadata (not private keys or proof witnesses)
- **Missing security headers** on critical endpoints (not already present in `next.config.js`)
- **Minor access control gaps** not enabling fund loss or key exposure

---

## 4. Reward Payment

- **Currency**: USDC (Ethereum mainnet) or ETH
- **Payment timeline**: Within 30 days of validated report
- **Safe Harbor**: Researchers acting in good faith are protected from legal action under this program

---

## 5. Disclosure Policy

**Responsible Disclosure Requirements**:

1. **Do not exploit** beyond what is necessary to demonstrate the vulnerability
2. **Do not access** other users' private data
3. **Do not perform** DoS attacks
4. **Report privately** before public disclosure
5. **Allow 90 days** for the team to remediate before public disclosure

**Disclosure Timeline**:
- T+0: Report received; acknowledgment within 24 hours
- T+7 days: Severity assessment and reward estimate communicated
- T+30 days: Fix deployed (CRITICAL) or remediation plan shared (HIGH)
- T+90 days: Public disclosure permitted if researcher agrees

---

## 6. Hall of Fame

Security researchers who responsibly disclose valid vulnerabilities will be credited in:
- `docs/AUDIT_DOSSIER.md` Hall of Fame section
- Protocol release notes
- Immunefi program page (with researcher's consent)

---

## 7. Contact

**Before program goes live on Immunefi**:
- GitHub: Open a **private security advisory** on the repository
- Email: security@humanidfi.com (PGP key to be published)

**After program is live**:
- Immunefi program page: `https://immunefi.com/bounty/humanityledger/`

---

## 8. Production Gate

This bug bounty program **activates** only after:

1. ✅ External audit completed by a firm listed in `docs/AUDIT_SCOPE.md`
2. ✅ All CRITICAL and HIGH audit findings remediated
3. ✅ `docs/AUDIT_DOSSIER.md` updated with audit report reference
4. ✅ Protocol Lead approval
5. ✅ Immunefi submission reviewed and approved

See `CONTRIBUTING.md` for the full production gate checklist.
