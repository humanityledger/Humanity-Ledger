# PIN Protection Security Decision

## Architecture Decision: Screen Lock (Not Key Derivation)

### Context
Humanity Ledger provides a 6-digit PIN during onboarding. Historically this was referred to as "Enclave PIN" or "Secure Enclave".

### Decision
1. **Scope**: The PIN functions strictly as an application-level **screen lock** and session gating mechanism.
2. **Cryptographic Reality**: End-to-end messaging encryption keys are managed natively by XMTP via the connected Web3 wallet (or MLS identity keys). The PIN does NOT derive the master messaging private keys.
3. **Storage & Verification**: The PIN is salted with 16 bytes of cryptographically secure random bytes, hashed via scrypt/Argon2 with an application-level pepper (`PIN_PEPPER`), and verified with constant-time equality checks.
4. **Rate Limiting & Lockout**: Enforced at max 5 attempts per 5 minutes, backed by Redis sliding window counter.
5. **UI Terminology**: Replaced all misleading "enclave hardware encryption" references with "Screen Lock" and "Session Access PIN".
