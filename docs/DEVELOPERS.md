# Ledger Network SDK (Alpha)

Welcome to the Ledger Network SDK. This repository serves as the sovereign command center for privacy-preserving applications built on the Aztec Network.

By integrating with the Ledger Network SDK, developers can interact with our 18 deep Noir circuits, leverage our Private Execution Environment (PXE), and build their own sovereign applications that plug seamlessly into our identity and portfolio dashboards.

## Why Build with Us?
- **Zero-Knowledge Identity**: Leverage `Humanity Ledger` to gate access to your dApps without collecting user data.
- **Selective Disclosure**: Request specific proofs (e.g. "Is over 18", "Is not sanctioned") rather than raw data.
- **Portfolio Privacy**: Allow users to manage cross-chain assets natively inside a fully isolated, shielded enclave.
- **Studio Provenance**: Utilize our E2EE chat and supply chain provenance tools directly via API.

## Core Architecture
Ledger Network operates entirely client-side. We use **Barretenberg** to compile Noir circuits to WebAssembly (WASM), ensuring that witness generation and proof construction never leave the user's browser.

### 1. Installation
The SDK requires an active Aztec Node. By default, it connects to the Aztec Mainnet (`node.aztec.network`).

```bash
npm install @ledgernetwork/sdk
```

### 2. Initialization

```typescript
import { LedgerNetwork } from '@ledgernetwork/sdk';

const ledger = new LedgerNetwork({
  pxeUrl: 'http://localhost:8080',
  network: 'testnet'
});

await ledger.init();
```

### 3. Identity Verification (ZKPassport Integration)
Ledger Network is designed to interoperate seamlessly with Aztec ecosystem tools like ZKPassport.

```typescript
// Request a zero-knowledge proof of nationality without revealing the country
const proof = await ledger.identity.requestProof({
  credentialType: 'ZKPassport',
  assertion: {
    attribute: 'nationality',
    operator: 'in',
    value: ['EU_MEMBER_STATES']
  }
});

// Verify the proof on-chain
const isValid = await ledger.identity.verify(proof);
```

### 4. Bounties & Builder Program
We are actively funding developers who build modules on top of the Ledger Network.
Currently open bounties:
- Integration with Azguard Wallet (Account Abstraction)
- Private DeFi yield tracking within the Portfolio module
- E2EE Chat extensions

For more details on bounties, visit our [Discord / GitHub Issues](https://github.com/ledgernetwork/ledger-wallet/issues).
