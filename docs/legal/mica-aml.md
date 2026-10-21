# MiCA and AML Analysis — Pre-Mainnet Requirement

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
| Anonymous transfers | Aztec ZK provides privacy — transactions visible on-chain but amounts/recipients hidden |
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
