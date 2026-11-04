# Aztec ZK Architecture Decision

> **Date**: 2025-10-20  
> **Status**: Decided
>
> **Note (4 Nov 2026):** the `/prove` route described below was never built. The browser PXE runs inside the Aztec SDK's embedded wallet (`lib/aztec/wallet/client.ts`), and the standalone-circuit Web Worker prover (`lib/zk/prover.worker.ts`) is not wired into any page.

## Question

Where do Aztec keys live — in an external wallet, or in a server-side/browser PXE?

## Decision: External Wallet + Browser PXE (no server custody)

Aztec keys live **in the user's browser** via the PXE (Private eXecution Environment) running in a Web Worker on the `/prove` route. The server holds **no keys, no notes, no proofs-in-progress**.

## Architecture

```
User Browser
├── XMTP SDK (keys in IndexedDB, encrypted)
├── Aztec PXE (Web Worker on /prove route, COOP/COEP isolated)
│   ├── Schnorr account keys (never leave browser)
│   ├── Private notes (local PXE database)
│   └── Proof generation (UltraHonk/BB)
└── Wallet (MetaMask / Rabby for L1 tx signing)

Server (no ZK state)
├── Bridge validation (verify L1 tx hash, portal, amount)
├── txHash relay (chat messages carry only the hash)
└── ZK feature flag (NEXT_PUBLIC_ZK_MODE=testnet)
```

## Rejected: Server-side PXE (sidecar.ts)

`lib/aztec/pxe/sidecar.ts` has been archived. Running a PXE on the server means:
- The server can read all private notes → **not non-custodial**
- Horizontal scaling is broken (PXE state is per-instance)
- If the server is compromised, all user funds are at risk

## Key Files

| File | Purpose |
|------|---------|
| `lib/aztec/wallet.ts` | Connect or create Aztec account |
| `lib/aztec/transfer.ts` | Private token transfer via `TokenContract` |
| `lib/aztec/bridge.ts` | L1→L2 bridge with L1 receipt validation |
| `lib/aztec/node.ts` | Aztec node health + fallback |
| `lib/zk/prover.worker.ts` | Web Worker for the standalone circuits (tests only; replaced the `0x` stub `public/workers/prover.worker.js` on 4 Nov 2026) |

## Testnet Gate

ZK features are only available when `NEXT_PUBLIC_ZK_MODE=testnet`.
Mainnet requires:
1. External security audit of all Noir contracts (H-037)
2. Legal review (N-008)
3. 0 critical/high findings from audit
