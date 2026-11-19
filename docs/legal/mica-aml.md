# MiCA and AML Analysis — Pre-Mainnet Requirement

> **Status (19/11/2026): internal draft, not in force.** It has not been reviewed by a lawyer (OD-8). The live texts are the pages at /docs (lib/docs/pages/legal.ts). Facts that override anything below: the controller is Stefan Antonio Cirisanu, a private individual (no company exists yet); there is no data protection officer and no external consultancy; the visit counter stores nothing in the browser since 19/11/2026.

**Last updated**: October 2025  
**Status**: Required before mainnet launch

---

## Summary

Before enabling real (mainnet) token transfers on Humanity Ledger, an analysis under MiCA (Markets in Crypto Assets Regulation) and applicable AML (Anti-Money Laundering) regulations is required.

---

## MiCA Considerations

| Feature | MiCA Classification | Action Required |
|---------|---------------------|----------------|
| Token transfers (Aztec ZK) | Possible "crypto-asset service" | Legal opinion required |
| Community treasury | Possible "issuance" if token created | Legal opinion required |
| Fiat on-ramp/off-ramp | Payment institution license | NOT planned — no fiat ramp |

**No fiat ramp** is planned in the initial version. This reduces MiCA exposure significantly.

---

## AML Considerations

| Risk | Mitigation |
|------|-----------|
| Private transfers (not anonymous) | Aztec hides amounts and parties; the fee payer is visible on Alpha; cUSDC adds identity and sanctions screening at the bridge |
| OFAC sanctions compliance | Sanctions check on L1 bridge transactions (N-009) |
| KYC requirements | May be required depending on jurisdiction and volume |

---

## Action Items

1. [ ] Engage specialized Web3 legal counsel (MiCA jurisdiction: Spain/EU)
2. [ ] Determine if transfer volumes trigger VASP registration
3. [ ] Implement sanctions screening on bridge routes
4. [ ] Add transaction limits during testnet phase (✅ H-038 done)
5. [ ] Gate mainnet behind legal clearance (✅ feature flag in place)

---

## Current Status

- Testnet: Enabled with volume limits (H-038 ✅)
- Mainnet: **Blocked** pending legal analysis and contract audit (H-037)
- No fiat on/off ramp: Reduces regulatory surface area

---

## Resources

- [MiCA Text (EU 2023/1114)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1114)
- [EBA AML Guidelines for CASPs](https://www.eba.europa.eu/)
- [FATF Travel Rule](https://www.fatf-gafi.org/)
