## Security & Invariant Checklist

### Mandatory Invariant Analysis Section (Fortification Item 264)
*Required for any PR affecting circuits, cryptography, L1 contracts, or private state transitions:*

- **Target Invariant(s)**: *(e.g., P1 Confidentiality, P2 PCS, P3 Private State, P4 Integrity, P5 No Key Custody, P6 EAF Isolation)*
- **Mathematical Bound / Constraint Enforced**: *(e.g., amount > 0, timelock >= 14 days, epoch ratchet)*
- **Negative Test Procedure**: *(Cite test file and scenario demonstrating rejection of invalid state transitions)*
- **Verification Key Impact**: *(Does this PR alter Noir circuits? If yes, provide new VK hash and timelock proposal tx)*

---

### Standard Security Verification:

#### Authentication & Key Custody (P5)
- [ ] No private keys or seeds generated via `Math.random` (OS CSPRNG only)
- [ ] No server-side key custody (zero private spending/identity keys in server DB or session)
- [ ] No route reads identity from untrusted headers (`x-web3-address`) — use `requireWallet()` only
- [ ] All new API routes call `requireWallet()` or are explicitly marked public in `routes.csv`
- [ ] Sensitive buffers are zeroized with `zeroizeBuffer` immediately after use

#### ZK / Aztec / Circuits (P3, P4)
- [ ] Zero simulation tokens (`Fr.random`, `mockWorkerProof`, `simulatedNullifier`)
- [ ] All private inputs generated and retained purely in client-side Web Worker
- [ ] Negative test cases added for all modified circuit constraints

#### EAF & Sandbox (P6)
- [ ] Air-gapped CSP enforced (`default-src 'none'; connect-src 'none'`)
- [ ] 8 KB maximum payload limit enforced
- [ ] Member ID in bridge messages bound to authenticated session (forgery rejected)

#### Supply Chain & Code Quality
- [ ] `npm audit` returns 0 vulnerabilities
- [ ] `scripts/check-traceability.ts` passes with zero contradictions
- [ ] No new cryptographic dependencies without security team review
- [ ] Signed commits enabled for all contributors

---
**Security Impact Analysis**: Describe the security context and threat model considerations.
**Automated Verification**: Cite the automated tests passing in CI.
