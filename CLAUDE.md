# CLAUDE.md — Humanity Ledger / Ledger Chat Execution Rules

## §1 Truth & Brand Invariants (Cited by app/layout.tsx)
- Every public/UI/SEO claim MUST match live runtime code (README.md, deployments/aztec-mainnet.json, lib/payments/assets.ts).
- External audit status stays "audit": null until a signed third-party report is committed. Never invent audit claims, legal entities, tax IDs (taxId: null), or treasury multisig addresses.
- Operator legal entity changes (lib/constants/legalEntity.ts) and binding legal copy (lib/docs/pages/legal.ts) obey OD-8: generate diffs/proposals for counsel + Stefan Antonio Cirisanu, NEVER silently rewrite binding legal terms or set CUSDC_GATES to true without real archived evidence.
- Single authority on network state: deployments/aztec-mainnet.json and docs/audit/START_HERE.md. Ignore legacy docs listed in START_HERE.md §7.
## §2 Token-Saving Execution Protocol (MANDATORY)
- Locate-Before-Read: Always locate exact line ranges via git grep -n scoped to target folders (-- app lib components contracts) BEFORE opening a file.
- Bounded Slices Only: NEVER read entire files >250 lines (LedgerChatV2.tsx, prisma/schema.prisma, lib/aztec/wallet/client.ts). Read exact offset/limit blocks (<=150 lines per read). Never re-read a file you just edited; inspect changes with git diff -- <file>.
- Parallel Batching: Batch independent git grep, file reads, and disjoint file edits in a single turn. Plan the exact diff + regression test BEFORE modifying any file ("Measure twice, edit once").
- Compressed Terminal Output: NEVER dump verbose passing logs into context. Always pipe/filter long test/build/lint commands to show ONLY failure lines or the last 25 lines (--reporter=dot in Vitest, redirect full output to /tmp/ only if exit code != 0).
- Micro-Test Loop: During edits run ONLY the targeted Vitest/Hardhat/TXE spec for that file. Run tsc --noEmit, eslint, and full next build ONLY ONCE at the end of the phase.
- Zero-Drop Checkpointing: Read EXECUTION_LEDGER.md + only the active Phase section from the Master Prompt at session start. Update EXECUTION_LEDGER.md ONLY once right before committing at session end.
## §3 Architecture Guardrails
- requireWallet(req) & getClientIP(req) (lib/security/rateLimiter.ts) are the ONLY valid auth/IP extractors in API routes. Direct x-forwarded-for parsing or x-web3-address/x-wallet-address trust is forbidden.
- Single HTTP session cookie hl_session (+ rotating refresh if used); purge system_handshake, wallet-auth, fake deriveAztecAddress, and legacy simulated QDs routes.
- Zero client/build suppressions: work toward removing @ts-nocheck, @ts-ignore, (prisma as any), ignoreBuildErrors, ignoreDuringBuilds, and minimize: false.
- Settings: every key the settings UI writes must have a default in lib/settings/schema.ts (device sync and /api/chat/settings derive their allowlist from it; test/unit/settings/settings-sync.test.ts enforces it).

## §4 Local environment note
- node_modules on D:\ are installed for Windows: vitest/next/tsx (native rollup/esbuild/swc) do not run from the Linux shell. Run them from Windows PowerShell, or use `node node_modules/typescript/bin/tsc` (pure JS) for type checks.
