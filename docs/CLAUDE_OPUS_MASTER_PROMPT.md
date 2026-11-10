# HUMANITY LEDGER — MASTER UPGRADE PROMPT FOR CLAUDE OPUS 5.5
**Target Model:** Claude 3.5 Sonnet / Claude 3.7 Sonnet / Claude Opus 5.5 (Maximum Reasoning & Cryptographic Rigor)  
**Protocol Alignment:** Aztec Labs Standards & True zk.money Parity  
**Target Environment:** Mobile Safari (iOS), Android Chrome, Desktop, Railway Production  
**Repository:** `https://github.com/humanityledger/Humanity-Ledger` (main branch)

---

## 1. PROTOCOL STATUS & HONEST CODE AUDIT

Before writing code or architecting changes, you must understand the exact current state of Humanity Ledger (`ledgerchat.org`). We have completed an exhaustive audit of the codebase:

### Current Reality: What is Live vs What is Simulated
1. **Authentication & Identity (REAL):** 
   - SIWE (EIP-4361) 1-Click login signed by the user's Ethereum wallet.
   - Server verification in `/api/siwe/verify` issues `hl_session` with `SameSite=None; Secure` so mobile Safari keeps the session when returning from MetaMask/Rainbow/Trust.
2. **Messaging Layer (REAL):**
   - XMTP direct messaging with local IndexedDB (`chatDB`) storage on the user's device.
   - End-to-end encrypted packet relays with zero server message custody.
3. **Communities Engine (HYBRID RESILIENT):**
   - Dual-mode architecture: PostgreSQL via Prisma for persistent server storage, backed by `in-memory-communities.ts` as an automatic fallback when Railway DB connections experience latency, preventing `500 Internal Server Error`.
   - Top-level workspace navigation now directly surfaces: *Posts*, *Chat & Channels*, *View Members*, *Search Messages*, *Pinned Messages*, *Governance*, *Analytics*, and *Settings*.
4. **Aztec Zero-Knowledge Privacy Layer (SIMULATED $\rightarrow$ NEEDS MAINNET UPGRADE):**
   - **Critical Truth:** In `lib/zk/zkMoney.ts` (line 565), `executeShieldedPayment()` requires `process.env.NEXT_PUBLIC_ZK_MODE === 'demo'`. It simulates transaction hashes using `randomHex(32)` and updates local state.
   - In `lib/zk/aztecPxe.ts`, key derivation (Grumpkin/BN254) and SMT-32 nullifier verification are calculated locally via `@noble/hashes` (SHA256) rather than executing real WASM Barretenberg constraint systems against an active Aztec Sequencer node.
   - **Protocol Context:** Legacy `zk.money` (Aztec Connect) was sunset in March 2023. Aztec Labs is developing the generalized **Aztec Network** using **Noir smart contracts** and client-side **PXE (Private eXecution Environment)**. Aztec Network is currently in Alpha Testnet/Devnet.

---

## 2. CRITICAL MISSION OBJECTIVES

We must graduate Humanity Ledger from simulated testnet features to a sovereign, institutional protocol that Aztec Labs will officially validate and celebrate:

```mermaid
flowchart TD
    A["Humanity Ledger Protocol"] --> B["1. Mobile Signing (Safari/Chrome Native)"]
    A --> C["2. Aztec Brand System & Docs (/docs/brand)"]
    A --> D["3. Chat Feature Hardening (+ Menu & Audio)"]
    A --> E["4. Communities Resilience & Sober UI"]
    A --> F["5. iPhone Signal-Surpassing Presentation"]
    A --> G["6. Aztec Real Node Integration (zk.money Parity)"]
```

---

## 3. DEEP TECHNICAL SPECIFICATIONS

### Pillar 1: Native Mobile Safari & Chrome Wallet Signing (iOS & Android)

#### Root Cause of Mobile Failures
When users on mobile Safari or Android Chrome tap a wallet, naive implementations do `window.location.href = "https://metamask.app.link/dapp/..."`. This forces the page to open inside MetaMask's internal WebView, which breaks viewport zoom scaling (`zoom: 0.67`), isolates localStorage, and prevents users from using any other wallet.

#### Required Architecture
1. **AppKit Mobile Sheet:** In `config/appkit.tsx`, ensure `walletConnect({ showQrModal: true })` and `multiInjectedProviderDiscovery: false`.
2. **Provider Detection:** In Safari on iOS, `window.ethereum` is undefined. Only inject the `injected()` connector when `typeof window !== 'undefined' && Boolean(window.ethereum)`.
3. **The Relay Protocol:** In `components/landing/ConnectPage.tsx`, mobile wallet selection calls `openAppKitSafe()`. AppKit opens the user's wallet via a standard universal link (`wc://` URI). The user signs in their wallet, switches back to Safari, and the signature arrives over the WalletConnect WebSocket relay without Safari navigating away.
4. **Cookie Security:** Cookies (`hl_session`, `system_handshake`) must maintain `SameSite=None; Secure` in production to survive iOS 15+ Intelligent Tracking Prevention (ITP) during the browser $\rightarrow$ wallet $\rightarrow$ browser switch.

---

### Pillar 2: Aztec Brand System & Institutional Documentation

#### The Standard
Aztec Labs prioritizes cryptographic rigor, typographic discipline, and architectural clarity. Zero emojis in protocol interfaces, zero speculative hype, and mathematical precision.

#### Required Architecture
1. **Brand Section in Docs (`/docs/brand`):**
   - **Typography System:** Inter Display (`-0.02em` tracking, 600 weight) for display headers; Inter (`-0.01em` tracking, 400/450) for body text; JetBrains Mono / SF Mono for addresses (`0x...`), hashes, and circuit proofs; Tabular figures (`tabular-nums`) for currency amounts.
   - **Palette Tokens:** Aztec Deep Violet (`#5200FF`), Sovereign Onyx (`#15171C`), Cool Slate Canvas (`#F7F8FA`), Subtle Structural Border (`#E4E7EC`), Shield Emerald (`#10B981`), and Revocation Vermilion (`#FF3B30`).
   - **Clear Space:** Minimum 50% glyph height clear space boundary; minimum 24px digital render limit.
2. **Docs Integration:** Registered in `lib/docs/registry.ts` under Company navigation, rendered dynamically by `app/docs/[slug]/page.tsx`.

---

### Pillar 3: Chat Action Engine (`+` Menu) & Audio Playback Hardening

#### Sane Drawer Inventory
The attachment drawer in `components/terminal/LedgerChatV2.tsx` must contain ONLY the 9 hardened, reliable actions:
1. `camera`: Native environment capture (`<input type="file" capture="environment" accept="image/*,video/*" />`).
2. `gallery`: Photos and videos from device library (`accept="image/*,video/*"`).
3. `attach`: Document picker up to 1MB (`accept="*/*"`).
4. `poll`: Multi-choice cryptographic voting component.
5. `zkmoney`: Aztec zero-knowledge private payment modal.
6. `agreement`: Escrow and streaming payment composer on Aztec.
7. `zkinvoice`: Shielded private invoice request.
8. `payment`: Direct EVM on-chain wallet transfer.
9. `burn`: Disappearing messages duration picker (5s to 24h).

*Note: `live location` (which spammed messages via `watchPosition`), `tip`, and `gif` are completely removed from the drawer.*

#### Voice Note Audio Pipeline
1. **Recording:** `components/chat/LedgerChatVoiceNote.tsx` records via MediaRecorder with dynamic MIME detection (`audio/webm;codecs=opus` on Chromium, `audio/mp4` / `audio/aac` on iOS Safari).
2. **Transport:** Audio blobs must NOT be embedded directly as huge base64 strings in XMTP (which causes silent drops above 1MB). They must POST to `/api/chat/attachments`, where magic bytes validate against audio signatures, returning a clean payload.
3. **Playback:** `CustomAudioPlayer.tsx` must await `audio.play()` and catch browser autoplay rejections gracefully without breaking the play/pause state machine.

#### Message Context Menu (Right Click / Long Press)
In `LedgerChatV2.tsx`:
- Robustly calculate message ownership: `const mine = Boolean(targetMsg?.isMe || (myAddr && msgSender === myAddr));`.
- **Eliminar mensaje para mí:** Always available for any message (local removal from IndexedDB).
- **Eliminar para todos:** Available for user's own messages (broadcasts `__REVOKE__${id}` over XMTP).
- Do not let "Report" replace deletion options.

---

### Pillar 4: Communities Architecture & Sovereign UI

#### Zero-Crash Fallback
All community endpoints (`/api/chat/communities`, `/api/chat/communities/[id]`, `/api/chat/communities/[id]/posts`) wrap database queries in resilient try/catch blocks that fall back to `lib/communities/in-memory-communities.ts`. Railway database disconnects must never trigger `500 Internal Server Error`.

#### Sober Workspace UI
In `components/chat/CommunityView.tsx`, the horizontal navigation strip exposes:
- **Posts:** Rich community posts with markdown and sanitizer.
- **Chat & Channels:** Structured topic channels (`#general`, `#announcements`).
- **View Members:** Panel listing wallet addresses, roles (Admin/Moderator/Member), and join dates.
- **Search Messages:** In-community query engine with highlighted match jumping.
- **Pinned Messages:** Pinned announcement repository.
- **Governance:** 1-Wallet-1-Vote proposal creation and voting.
- **Analytics:** Sober cryptographic metrics (active signers, message velocity, channel distribution).
- **Settings:** Admin controls for channel creation, pricing, and privacy toggles.

---

### Pillar 5: Signal-Surpassing iPhone Presentation

In `components/landing/v2/PhoneShowcase.tsx` and `PhoneShowcase.module.css`:
1. Use pure CSS hardware frames (`.iphoneFrame` with 54px corner radius, titanium bezels, and responsive diagonal scroll matrix) instead of fragile external photographs.
2. Render interactive, live vector components inside the frame:
   - Dynamic Island aperture with pulsing connection indicator.
   - Shielded Aztec invoice split cards (`ZkInvoiceBubble`).
   - WebRTC encrypted voice and video call states.
   - Multi-channel community feeds.

---

### Pillar 6: Aztec Testnet-to-Mainnet Migration Roadmap (zk.money Parity)

To graduate from local simulation to true on-chain Aztec Network integration:

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Safari/Chrome)
    participant Client as Ledger Chat Client
    participant PXE as Aztec PXE (Web Worker)
    participant AC as Aztec Account Contract (Schnorr/ECDSA)
    participant Token as Aztec Noir Token Contract
    participant Sequencer as Aztec Sequencer / Node

    User->>Client: Send 100 USDC to zk:alice
    Client->>PXE: Request Private Transfer
    PXE->>AC: Authenticate via Ethereum Wallet Signature
    PXE->>Token: transfer_private(from, to, amount)
    PXE->>PXE: Generate UltraHonk Proof (WASM Barretenberg)
    PXE->>Sequencer: Submit Tx with Proof + Encrypted Logs + Nullifier
    Sequencer-->>Client: Tx Effect Confirmed on Rollup Block
    Client-->>User: Shielded Payment Settled (AztecScan verified)
```

#### Step-by-Step Implementation Checklist
1. **Replace Mock Prover:**
   - Migrate `lib/zk/zkMoney.ts` from `randomHex` mock transactions to `@aztec-labs/aztec.js` (or `@aztec/aztec.js`).
   - Connect client to Aztec RPC node (`NEXT_PUBLIC_AZTEC_NODE_URL`).
2. **Browser PXE Initialization:**
   - Run Aztec PXE in a dedicated Web Worker using `@aztec/bb.js` and Barretenberg WASM so proof computation does not block the UI thread.
   - Store private note commitments in IndexedDB via Aztec's persistent key-value store.
3. **Noir Contract Deployment:**
   - Deploy standard Noir `TokenContract` on Aztec Testnet.
   - Expose methods: `transfer_private`, `shield`, `unshield`, and `batch_transfer`.
4. **Account Abstraction:**
   - Derive Aztec accounts using the user's Ethereum wallet via `EcdsaAccountContract` or `SchnorrAccountContract`.
5. **Cross-Chain Portal:**
   - Deploy L1 Portal contract on Ethereum Sepolia/Mainnet to bridge real USDC into Aztec shielded notes.

---

## 4. STRICT OPERATIONAL RULES FOR CLAUDE OPUS

1. **Maintain Cryptographic Integrity:** Never bypass authentication checks, never introduce Web2 email/password credentials, and never store unencrypted messages or private keys on servers.
2. **Preserve Comments & Type Safety:** Retain existing security comments, invariant explanations, and TypeScript types.
3. **Mobile First:** Ensure all touch targets adhere to Apple HIG (44pt minimum) and viewport safe-area insets (`env(safe-area-inset-bottom)`) are respected.
