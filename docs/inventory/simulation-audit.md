# Simulation Audit Inventory — I-002

This document audits references to simulated or mock logic across the repository.

| Module / File | Previous Status | Current Status | Remediation |
|---|---|---|---|
| `app/api/zk/sequencer/route.ts` | Fake batch generation (`Math.random`) | REMEDIATED | Replaced with real RPC proxy or 501 disabled (I-003) |
| `lib/zk/zkMoney.ts` | Fixed token prices ($2,650) | REMEDIATED | Removed static prices, oracle feed implemented (I-004) |
| `lib/zk/zkCommunityPayments.ts` | Fixed ETH rate ($2,650) | REMEDIATED | Fixed rates replaced with stablecoin accounting |
| `lib/zk/localStorage-purge.ts` | Client localStorage used as truth | REMEDIATED | Automatic purge on startup, state moved on-chain (I-017) |
| `components/zk/ZkCommunityTreasury.tsx` | Demo treasury UI | GATED | Gated behind `NEXT_PUBLIC_ZK_MODE` flag |
| `components/shared/DemoBadge.tsx` | Inconsistent demo labeling | UNIFIED | Standardized DemoBadge component deployed (I-010) |
| `lib/flags.ts` | Non-core modules enabled | REMEDIATED | All non-core modules disabled by default in production (I-029) |
| `scripts/forbidden-patterns.mjs` | No automated simulation check | ENFORCED | Script checks entire codebase on every commit (I-030) |
