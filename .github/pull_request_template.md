## Security Checklist

### Before submitting this PR, verify:

#### Authentication & Authorization
- [ ] No route reads identity from headers (`x-web3-address`, `x-wallet-address`) — use `requireWallet()` only
- [ ] All new API routes call `requireWallet()` or are explicitly marked public in `routes.csv`
- [ ] No `system_handshake` cookie reads added
- [ ] No hardcoded secrets or fallback secret values added

#### Input Validation
- [ ] All route inputs validated with Zod schema
- [ ] All `findMany` calls have a `take` limit (max 100)
- [ ] No `(prisma as any)` cast added without justification

#### Data Privacy
- [ ] No PII logged (email, wallet address, message content)
- [ ] No message content in push notification payloads
- [ ] No financial data stored in localStorage

#### Code Quality
- [ ] TypeScript compiles without errors (`tsc --noEmit`)
- [ ] ESLint passes (`next lint`)
- [ ] Forbidden patterns check passes (`node scripts/forbidden-patterns.mjs`)
- [ ] Unit tests pass (`vitest run test/unit/security`)

#### ZK / Aztec
- [ ] No simulated/fake proofs added
- [ ] ZK features behind feature flag (`NEXT_PUBLIC_ZK_MODE`)
- [ ] No hardcoded prices or balances

---
**Bug/Security Fix:** Describe the security impact if applicable.
**Testing:** How did you test this change?
