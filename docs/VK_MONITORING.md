# Humanity Ledger — VK Monitoring & Client-Side Verification
**Version 1.0 — 2026-10-31**  
**Authority**: `docs/PROTOCOL_SPEC.md` §8 (Circuit Migration and Versioning Policy)

---

## 1. Overview

Verification keys (VKs) are the cryptographic commitment to a specific Noir circuit. A changed VK means a different circuit is being verified — this could represent a legitimate upgrade or a malicious substitution. The Humanity Ledger protocol requires:

1. **Client-side VK assertion**: Every wallet initialization compares local VK hashes against on-chain registry.
2. **60-second detectability**: Any on-chain VK change must trigger an alert within 60 seconds.
3. **Lifecycle enforcement**: DEPRECATED VKs warn users; RETIRED VKs block proof construction.

---

## 2. VK Registry On-Chain

VKs are committed via `HumanityTimeLockVault` with a **14-day timelock**:

```solidity
// TimelockVault queues a VK update
function queueOperation(bytes32 operationId, address target, bytes calldata data) external onlyOwner;
function execute(bytes32 operationId) external; // callable only after executeAfter
```

**Event emitted on queue**:
```solidity
event TransactionQueued(bytes32 indexed operationId, address indexed target, uint256 executeAfter);
```

**Monitoring hook**: Subscribe to `TransactionQueued` events on `HumanityTimeLockVault` using any of:
- Tenderly Alerts: filter `TransactionQueued` on contract address
- OpenZeppelin Defender Sentinel: webhook on VK registry contract
- Aztec node block listener (custom): poll new blocks every 12 seconds

### 60-Second Detectability Path
1. Block listener polls Aztec testnet RPC every 12 seconds (Ethereum L1 finality ~12s)
2. On `TransactionQueued` event: extract `operationId`, decode `data` to VK hash
3. Compare decoded VK hash with local `circuits/*/target/*.vk.json`
4. If mismatch: fire webhook → PagerDuty / Slack / email within the same block interval

---

## 3. Client-Side VK Hash Assertion (`lib/aztec/verifier.ts`)

On every wallet initialization, the client performs:

```typescript
// lib/aztec/verifier.ts
import escrowVK from '../../circuits/escrow/target/escrow.vk.json';
import streamsVK from '../../circuits/streams/target/streams.vk.json';
import identityVK from '../../circuits/identity/target/identity.vk.json';
import { createHash } from 'crypto';

export interface VKRecord {
  circuit: string;
  localHash: string;
  onChainHash: string | null;
  status: 'ACTIVE' | 'DEPRECATED' | 'RETIRED';
}

/**
 * Computes the SHA-256 hash of a VK JSON artifact.
 */
export function hashVK(vk: object): string {
  return createHash('sha256').update(JSON.stringify(vk)).digest('hex');
}

/**
 * Asserts that local VK hashes match the on-chain registry.
 * Throws on RETIRED VKs; warns on DEPRECATED VKs.
 * 
 * @param onChainRegistry - Map of circuit name → { hash, status } from on-chain query
 */
export function assertVKIntegrity(
  onChainRegistry: Record<string, { hash: string; status: 'ACTIVE' | 'DEPRECATED' | 'RETIRED' }>
): VKRecord[] {
  const localVKs: Record<string, object> = {
    escrow: escrowVK,
    streams: streamsVK,
    identity: identityVK,
  };

  const results: VKRecord[] = [];

  for (const [circuit, vk] of Object.entries(localVKs)) {
    const localHash = hashVK(vk);
    const onChain = onChainRegistry[circuit];
    const onChainHash = onChain?.hash ?? null;
    const status = onChain?.status ?? 'ACTIVE';

    if (onChainHash && localHash !== onChainHash) {
      throw new Error(
        `[VK INTEGRITY] CRITICAL: Local VK hash for circuit '${circuit}' ` +
        `does not match on-chain registry. ` +
        `Local: ${localHash.slice(0, 16)}... On-chain: ${onChainHash.slice(0, 16)}...`
      );
    }

    if (status === 'RETIRED') {
      throw new Error(
        `[VK INTEGRITY] Circuit '${circuit}' VK is RETIRED. ` +
        `Proof construction is blocked. Please update the application.`
      );
    }

    if (status === 'DEPRECATED') {
      console.warn(
        `[VK INTEGRITY] WARNING: Circuit '${circuit}' VK is DEPRECATED. ` +
        `Please migrate to the new circuit version before the retirement date.`
      );
    }

    results.push({ circuit, localHash, onChainHash, status });
  }

  return results;
}
```

---

## 4. VK Lifecycle States

| State | Client Behavior | User Impact |
|---|---|---|
| `ACTIVE` | Normal operation | None |
| `DEPRECATED` | Warning banner shown; proving allowed | User urged to update before retirement date |
| `RETIRED` | Proof construction **blocked** | User must update app to continue transacting |

### Transition Rules (per PROTOCOL_SPEC §8)
- `ACTIVE` → `DEPRECATED`: Queued via `HumanityTimeLockVault` (14-day notice period)
- `DEPRECATED` → `RETIRED`: After 14-day timelock executes; old VK is no longer verifiable on-chain
- `ACTIVE` → `RETIRED`: Only in emergency (critical soundness bug); requires multisig + emergency governance

---

## 5. Current VK Status

| Circuit | Local Hash (SHA-256, first 16) | On-Chain Status | Last Updated |
|---|---|---|---|
| `escrow` | see `circuits/escrow/target/escrow.vk.json` | ACTIVE | 2026-10-29 |
| `streams` | see `circuits/streams/target/streams.vk.json` | ACTIVE | 2026-10-29 |
| `identity` | see `circuits/identity/target/identity.vk.json` | ACTIVE | 2026-10-29 |

> [!NOTE]
> VK JSON files in `circuits/*/target/` are placeholder artifacts pending full `nargo compile` integration. Real VKs require `nargo compile` on the Noir source circuits and will replace these artifacts before mainnet.

---

## 6. Monitoring Stack (Recommended Setup)

```yaml
# Tenderly Alert — VK Registry Monitor
name: VK Registry Change Alert
type: contract_event
network: 1  # Ethereum mainnet (or testnet ID)
contract: "0x<HumanityTimeLockVault_address>"
event: "TransactionQueued(bytes32,address,uint256)"
webhook:
  url: "https://your-alerting-endpoint.example.com/vk-alert"
  method: POST
  severity: CRITICAL
```

**Alternative: OpenZeppelin Defender Sentinel**
1. Create Sentinel monitoring `HumanityTimeLockVault`
2. Filter: `event.name == "TransactionQueued"`
3. Action: Webhook to Slack / PagerDuty with decoded `operationId`

---

## 7. Incident Response Integration

VK mismatch detected → immediately follow **Incident Class 2** in `docs/INCIDENT_RESPONSE.md`.

The 14-day timelock ensures users have a minimum 14-day window to detect and respond to any malicious VK substitution before it takes effect on-chain.
