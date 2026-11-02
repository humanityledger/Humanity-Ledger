# Humanity Ledger — Sequencer Censorship Resilience
**Version 1.0 — 2026-10-31**  
**Authority**: `docs/PROTOCOL_SPEC.md` §6 Threat Model P6 (Sequencer Censorship)

---

## 1. Overview

Aztec's sequencer is a single point that orders and batches transactions before L1 settlement. While Aztec's roadmap includes decentralized sequencing, the current testnet uses a centralized sequencer. This document defines the fallback behaviors that preserve user funds and private state in case of censorship, outage, or malicious exclusion.

**Fundamental Guarantee**: Private witnesses (nullifiers, commitments, proof inputs) are always held client-side. No sequencer failure or censorship can cause loss of private state.

---

## 2. Failure Detection

The client monitors transaction inclusion with a **60-second timeout**:

```typescript
// lib/aztec/sequencer-resilience.ts (pseudocode)
export async function submitWithFallback(
  tx: AztecTransaction,
  primaryRpc: string,
  fallbackRpcs: string[]
): Promise<string> {
  for (const rpcUrl of [primaryRpc, ...fallbackRpcs]) {
    try {
      const receipt = await submitAndWait(tx, rpcUrl, { timeoutMs: 60_000 });
      return receipt.txHash;
    } catch (err) {
      if (err instanceof TimeoutError || err instanceof SequencerRejectionError) {
        console.warn(`[SEQUENCER] Endpoint ${rpcUrl} failed: ${err.message}. Trying next...`);
        continue;
      }
      throw err; // Non-censorship error; propagate
    }
  }
  throw new Error('[SEQUENCER] All endpoints failed. Witness retained client-side. User may resubmit manually.');
}
```

---

## 3. RPC Endpoint Fallback List

| Priority | Endpoint | Type | Notes |
|---|---|---|---|
| 1 | `https://aztec-testnet.drpc.org` | Primary (testnet) | Current default |
| 2 | `https://api.aztec.network/aztec-testnet/node` | Official Aztec Labs | Backup |
| 3 | Local Aztec sandbox | `localhost:8080` | Dev/testing only |

**Mainnet fallback list** (to be populated at mainnet readiness):
- Infura Aztec endpoint (if available)
- Alchemy Aztec endpoint (if available)
- Self-hosted Aztec node

---

## 4. User-Facing "Resubmit" Flow

```
[Transaction submitted]
       |
       v
[Waiting for inclusion]
       |
   60s timeout?
     /       \
   No         Yes
   |            |
[Success]   [Show "Resubmit" button + explanation]
                |
            User clicks "Resubmit"
                |
            [Retry with same proof/nullifier — idempotent]
                |
            [Try next RPC in fallback list]
                |
            Success? → [Show confirmation]
            All fail? → [Show "Witness saved. Try again later" + download witness option]
```

### Resubmit Invariants
- The **same nullifier** is used on resubmit — prevents double-spend even if the original transaction eventually processes.
- The user's private witness is retained in browser `sessionStorage` (never `localStorage` or server) until confirmed.
- The resubmit button is available for **24 hours** after initial submission failure.

---

## 5. Client State Persistence During Sequencer Outage

| State | Storage | Duration | Cleared When |
|---|---|---|---|
| Proof bytes | `sessionStorage` (encrypted with session key) | 24 hours | Tab close or confirmation |
| Witness inputs | `sessionStorage` (encrypted) | 24 hours | Tab close or confirmation |
| Nullifier | Derived deterministically from note + secret; can be re-derived | N/A | N/A |
| Private note commitments | Client-side wallet database (EmbeddedWallet) | Persistent | Manual reset |

> [!IMPORTANT]
> The nullifier is **deterministically re-derivable** from the user's spending key and the note identifier. Even if `sessionStorage` is cleared, the user can re-derive the correct nullifier and resubmit safely.

---

## 6. L1 Escape Hatch

If the Aztec sequencer is persistently censoring a specific transaction, Aztec's protocol provides an L1 force-inclusion mechanism (under development). When available:

1. User constructs the L1 force-inclusion call directly against the Aztec rollup contract.
2. Transaction is included in the next Ethereum block (not dependent on sequencer).
3. Protocol Lead documents the censorship event in `docs/postmortems/`.

This mechanism is a last resort and is not yet production-ready on the current testnet.

---

## 7. Monitoring & Alerting

Sequencer health is part of the observability stack (`docs/OBSERVABILITY.md`):

- Metric: `aztec_sequencer_inclusion_time_ms` (p50/p95)
- Alert: Inclusion time > 60 seconds triggers `SEQUENCER_SLOW` alert
- Alert: 3 consecutive failures triggers `SEQUENCER_DOWN` + fallback activation

---

## 8. `LedgerDeadmanSwitch` Integration

If sequencer censorship is protocol-wide and confirmed malicious, the `LedgerDeadmanSwitch` contract can be activated:
- Freezes new proof submissions to the registry
- Emits `SwitchActivated` event observable by all clients
- Clients display: "Protocol in safe-freeze mode. No new transactions until further notice."

See `contracts/security/LedgerDeadmanSwitch.sol` and `docs/INCIDENT_RESPONSE.md` for the activation procedure.
