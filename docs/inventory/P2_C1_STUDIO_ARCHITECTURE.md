# P2-C.1 Studio Architecture

## 1. Components (STUDIO_COMPONENT_MAP)
*   **`ProvenanceSessionGate`**: Security/Auth wrapper component enforcing session validation, fallback SIWE sign-in, and wallet connection states.
*   **`ProvenanceStudioContent`**: The core multi-tab container interface managing Creation, On-chain Registry, and other features.
*   **`CreateTab`**: Complex form component handling inputs for passport creation, ZK issuance, logistics, sustainability metrics, and telemetry.
*   **`RegistryTab`**: Component rendering the list of user-created passports with sorting, status filtering, and CSV export.
*   **`SightInsightTab`**: Telemetry and network visualizer component displaying metrics (e.g. quantum shielded txs, relayer nodes).
*   **`TestnetExplorer`**: Sub-component to visualize the anchoring transaction status visually on the Aztec Mainnet.
*   **`SubscriptionDashboard`**: Dynamically loaded interface for managing user subscription and billing features.
*   **`StatPill`, `CopyButton`, `FieldLabel`**: Reusable micro-components for UI consistency.

## 2. APIs (STUDIO_API_MAP)
*   `GET /api/auth/studio`: **admin** - Validates wallet session and redirects with a generated short-lived SSO JWT to the B2B studio repo.
*   `GET /api/auth/verify-session`: **read** - Validates current server-side session credentials.
*   `GET /api/siwe/nonce`: **read** - Generates a secure nonce for Wallet connect verification.
*   `POST /api/siwe/verify`: **cryptographic** - Verifies EIP-4361 signature for authentication.
*   `GET /api/siwe/session`: **read** - Checks and retrieves the active SIWE session.
*   `POST /api/passport`: **mutation** - Creates a new Product Passport entry in the database.
*   `GET /api/passport/mine`: **read** - Fetches the authenticated user's list of product passports.
*   `POST /api/premium/prover`: **cryptographic** - Delegates Server-Side Zero-Knowledge proof generation based on circuit constraints.
*   `POST /api/premium/paymaster`: **financial** - Fetches gasless paymaster subsidization configurations for the transaction.
*   `POST /api/aztec/anchor`: **mutation** - Submits the transaction/proof to native Aztec network, bypassing EVM.
*   `POST /api/premium/webhooks`: **write** - Registers a webhook listener for on-chain anchoring success.
*   `PATCH /api/passport/[slug]/anchor`: **mutation** - Updates the database state of a passport with on-chain metadata (txHash, coreEntropy).
*   `POST /api/provenance/log`: **write** - Fire-and-forget logging of provenance events.

## 3. Data Models (STUDIO_DATA_MAP)
*   **`ProductPassportPublic`**:
    *   `title`, `slug`, `category`, `gs1Gtin`
    *   `payload`: Core schema containing `description`, `origin`, `batchId`.
        *   `logistics`: `carrier`, `trackingNumber`, `weightKg`, `dimensions`, `handlingConditions`.
        *   `lifecycle`: `carbonFootprintTotal`, `recyclabilityPercent`, `waterUsageLiters`, `materialComposition`.
        *   `telemetry`: `hasTemperatureSensors`, `hasShockSensors`.
    *   `events`: Array of historic events (e.g., `manufactured` with location data).
    *   `txHash`, `chainId`, `coreEntropy`, `createdAt`.
*   **`ProvenanceEvent`**:
    *   `type`: 'LEDGER_CHAT_SYNC', 'PORTFOLIO_ACCESS', or 'STUDIO_ACCESS'.
    *   `details`: Arbitrary JSON for telemetry.
