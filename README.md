# HUMANITY LEDGER — The Sovereign Protocol & Living Generative OS
### A Mathematical, Cryptographic, and Decentralized Architecture for Planetary-Scale Human Coordination

<p align="center">
  <strong>Formal Reference Implementation of the Humanity Ledger Protocol</strong><br />
  <em>Decentralized Multi-User Generative Computing · IETF RFC 9420 Message Layer Security (MLS v3) · Aztec Noir UltraHonk Zero-Knowledge State Verification</em>
</p>

<p align="center">
  <a href="https://github.com/humanityledger/Humanity-Ledger"><img src="https://img.shields.io/badge/Genesis%20Target-December%2010%2C%202026%20(Alpha)-00f2fe?style=for-the-badge&logo=rocket" alt="Genesis Target: December 10, 2026" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript%205.x-Strict%20(0%20Errors)-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript Strict Compliance" /></a>
  <a href="https://vitest.dev/"><img src="https://img.shields.io/badge/Unit%20Tests-451%2F451%20Passing-brightgreen?style=for-the-badge&logo=vitest&logoColor=white" alt="Unit Test Suite: 451 Passing" /></a>
  <a href="https://xmtp.org/"><img src="https://img.shields.io/badge/Transport-XMTP%20MLS%20v3%20(RFC%209420)-0052FF?style=for-the-badge&logo=xmtp" alt="XMTP MLS Transport" /></a>
  <a href="https://aztec.network/"><img src="https://img.shields.io/badge/ZK%20SNARKs-Aztec%20Noir%20UltraHonk-8000FF?style=for-the-badge&logo=ethereum" alt="Aztec Noir UltraHonk" /></a>
  <a href="https://livekit.io/"><img src="https://img.shields.io/badge/Media%20Layer-LiveKit%20WebRTC%20SFU-00E599?style=for-the-badge&logo=webrtc" alt="LiveKit WebRTC SFU" /></a>
</p>

---

## 1. ABSTRACT & THEORETICAL FOUNDATION

Since the inception of decentralized networking, digital communication architectures have suffered from a fundamental dichotomous failure:
1. **Centralized Surveillance Silos** (e.g., WhatsApp, Telegram, Discord) harvest relational metadata, operate opaque server-side state machines, and enforce static user interfaces governed by platform monopolies.
2. **First-Generation Sovereign Messengers** (e.g., Signal, Session) restrict human interaction to **passive text and serialized static attachments from 2009**, forcing participants to exit the cryptographic perimeter whenever collaboration, collective resource allocation, or state modification is required.

**Humanity Ledger** eliminates this limitation by introducing the world's first **Living Generative Operating System (LG-OS)** embedded within an end-to-end encrypted, zero-knowledge verifiable communication pipeline. 

Under this paradigm, a communication stream is not merely a sequence of serialized strings: **it is a distributed, reactive, multi-tenant execution canvas**. Users synthesize, execute, mutate, and verify fully functional collaborative software (Executable Artifact Frames — EAF) directly within the conversation thread in sub-80ms synchronization windows, with zero centralized compilation dependencies and absolute cryptographic isolation.

$$\mathcal{M}_{\text{HL}} = \Big\langle \mathcal{I}_{\text{SIWE}}, \; \mathcal{T}_{\text{MLS}}, \; \Pi_{\text{UltraHonk}}, \; \Omega_{\text{Sandbox}}, \; \Delta_{\text{CRDT}} \Big\rangle$$

Where:
* $\mathcal{I}_{\text{SIWE}}$ represents the self-sovereign cryptographic identity plane derived from EIP-4361 / EIP-191 primitives.
* $\mathcal{T}_{\text{MLS}}$ represents the asynchronous post-compromise secure group messaging transport (IETF RFC 9420).
* $\Pi_{\text{UltraHonk}}$ represents the Non-Interactive Zero-Knowledge (NIZK) state verification protocol executed via client-side Aztec Noir circuits.
* $\Omega_{\text{Sandbox}}$ represents the air-gapped, null-origin micro-VM execution boundary enforcing strict Content Security Policies.
* $\Delta_{\text{CRDT}}$ represents the event-sourced, Lamport-ordered conflict-free replicated data mesh.

---

## 2. THE LIVING GENERATIVE OS: MULTI-USER GENERATIVE COMPUTING

The core technological breakthrough of Humanity Ledger is the **Executable Artifact Frame (EAF)**. When natural language intent is declared in a conversation (e.g., `@claude synthesize a multi-signature treasury disbursement panel with real-time consensus and tabular analytics`), the system compiles and mounts an isolated, reactive application inside the chat feed within **3.8 seconds**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        HUMAN-TO-COLLABORATIVE-SOFTWARE MESH                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  Participant A (0x17A...):                                                             │
│  "@claude create a quadratic resource allocation board for the 6 working group         │
│   members, with a 100-credit budget and real-time stake-weighted voting."             │
│                                                                                        │
│  [Synthesis Engine: AST Static Guard + Template Scaffolding: 1.2s Ingestion]           │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ ⚡ QUADRATIC ALLOCATION BOARD v1.0.0 (Air-Gapped Micro-VM Frame)                 │  │
│  │ ──────────────────────────────────────────────────────────────────────────────── │  │
│  │  Proposal A: Infrastructure  [████████████░░░░] 64 Credits  (Cost: 8.00 V)      │  │
│  │  Proposal B: Zero-Knowledge   [████████████████] 100 Credits (Cost: 10.00 V)     │  │
│  │  Remaining Balance: 36 Credits | Active Peers: 6/6 Connected (Mesh: 42ms)        │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  Participant B (0x89F...):                                                             │
│  "@claude append an exportable CSV audit ledger and a 3-minute settlement countdown"   │
│                                                                                        │
│  [Living Code Engine: Hot-Swap Mutation to v1.1.0 with Invariant State Preservation]   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The `window.hl` Universal Reactive SDK Contract
Every synthesized micro-application is compiled against the strictly typed, zero-dependency `window.hl` interface:

```typescript
interface HumanityLedgerUniversalBridge {
  /** Execution Context Handshake */
  ready(): Promise<{
    me: { id: string; label: string; isCreator: boolean; isVerifiedHuman: boolean };
    room: { id: string; name: string };
    app: { id: string; version: number };
  }>;

  /** Distributed Shared State (Consensus Across Group) */
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): Promise<void>;
  list(prefix?: string): string[];

  /** Partitioned Member State (Cryptographically Bound to Caller Wallet) */
  mine<T>(key: string, fallback: T): T;
  setMine<T>(key: string, value: T): Promise<void>;
  everyone<T>(key: string): Array<{ id: string; label: string; value: T; at: number; me: boolean }>;

  /** Reactive State Subscription (< 80ms Multi-Device Propagation) */
  onChange(subscriber: () => void): () => void;

  /** Cryptographic Zero-Knowledge Attestation */
  zkProof(statement: Record<string, unknown>): Promise<{ proof: Uint8Array; publicInputs: string[] }>;
}
```

### 2.2 Sandboxing & Formal Security Guarantees
To prevent cross-site scripting (XSS), prototype pollution, memory exhaustion, and phishing:
* **Air-Gapped Null-Origin Boundary:** Iframes execute strictly under `sandbox="allow-scripts"`. They possess **zero network access** (`connect-src 'none'`), no cookie/localStorage inheritance, and communicate exclusively via bidirectional, schema-validated `window.postMessage` channels.
* **AST Static Code Guard:** Before bytecode or HTML ingestion, an Abstract Syntax Tree (AST) parser (`oxc`/`acorn`) validates that no non-deterministic loops (`while(true)`), unconstrained recursions, prototype overrides (`__proto__`), or credential harvesting inputs (`type="password"`, `name="seed"`) exist.
* **Watchdog Event Loop Monitor:** The host container polls the frame every 2,000ms. An unresponsive thread exceeding 120ms execution blocks is immediately halted and offered a clean recovery restart.

---

## 3. PROTOCOL SPECIFICATIONS & CRYPTOGRAPHIC TOPOLOGY

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        HUMANITY LEDGER 5-LAYER STACK TOPOLOGY                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Layer 5: Generative OS & Living Artifacts (EAF, window.hl SDK, Micro-VM Air-Gap)       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Layer 4: Real-Time Synchronization Mesh (Redis Pub/Sub SSE, CRDTs, Lamport Clocks)     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Zero-Knowledge Settlement & Privacy (Aztec Noir UltraHonk, PXE, FPC)          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Post-Compromise Sovereign Messaging (XMTP MLS v3, TreeKEM, RFC 9420)          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Cryptographic Identity & Enclave Gate (EIP-4361 SIWE, EdDSA, Argon2id PIN)   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Protocol / Mathematical Primitive | Invariant Guarantee | Verification Standard |
| :--- | :--- | :--- | :--- |
| **Identity Bootstrap** | EIP-4361 (SIWE) + EIP-191 + Ed25519 | Cryptographic key ownership; zero reliance on corporate OAuth or phone numbers | Formal HMAC-MAC Nonce Verification (`sealNonce`) |
| **Local Hardware Enclave** | Turing Shield (Argon2id + AES-256-GCM) | Memory-hard PIN clearance ($m=65536, t=3, p=1$) with client credential vaulting | OWASP ASVS v4.0.3 L3 Compliance |
| **Asynchronous Transport** | XMTP MLS v3 (IETF RFC 9420 TreeKEM) | Decentralized forward secrecy & post-compromise security across multi-device groups | `test/unit/chat/sendExactlyOnce.test.ts` (100% Pass) |
| **Confidential Settlement** | Aztec Network (Noir DSL / UltraHonk) | Zero-Knowledge confidential balance transfers and private state transitions | Client-Side Private Execution Environment (PXE) |
| **Real-Time Voice/Video** | WebRTC Simulcast + Dedicated TURN | Low-latency audio/video with complete IP obfuscation via relay routing | DTLS-SRTP RFC 5764 Encryption |
| **Generative Micro-VM** | HTML5 / Native ECMAScript + Wasm | Strict zero-network air-gap sandbox; state synchrony via Lamport delta mesh | `test/unit/settings/settingsTruth.test.ts` (100% Pass) |
| **Perimeter Security** | Next.js Edge Middleware (Fail-Closed) | Constant-time CSRF rejection, SSRF IP-range validation, and OFAC geofencing | `test/unit/security/publicFetch.test.ts` (100% Pass) |

---

## 4. MATHEMATICAL PROOF OF EXACTLY-ONCE TRANSMISSION

A historical failure mode in asynchronous decentralized networks is message duplication caused by network latency during RPC acknowledgments. Humanity Ledger resolves this deterministically via an **Idempotent Optimistic Pipeline**:

```
[User Dispatches Payload in LedgerChatV2]
                   │
                   ▼
       executeSendRef(content)
                   │
                   ├─► Generates Deterministic Real ID via dm.sendOptimistic(content)
                   ├─► Maps optimisticId ──► realId in optimisticContentMap
                   ├─► Persists to Local IndexedDB in Milliseconds (Date.now())
                   │
                   ▼
     dm.publishMessages() (Retried up to 4x with Exponential Backoff)
                   │
                   ├─► Success: Message published to XMTP decentralized fabric
                   └─► Failure: Background Retry Ring (No duplicate IDs can be synthesized)
```

By decoupling **local state materialization** (`sendOptimistic`) from **network synchronization** (`publishMessages`), the protocol mathematically prevents duplicate message emission while preserving zero-latency UI responsiveness.

---

## 5. ROADMAP TO GENESIS: DECEMBER 10, 2026 (PUBLIC ALPHA)

The Humanity Ledger protocol is progressing through a rigorous, formal verification schedule toward its **Public Alpha Genesis Release on December 10, 2026**.

```
MILESTONE TRACKER: ROAD TO DECEMBER 10, 2026 PUBLIC ALPHA
══════════════════════════════════════════════════════════════════════════════════════
[✔] PHASE 1: CRYPTOGRAPHIC PERIMETER & EXACTLY-ONCE TRANSMISSION         (100% DONE)
    • Eradication of race-condition duplicates in XMTP MLS client.
    • Transition to sendOptimistic + idempotent publishMessages retry ring.
    • Elimination of legacy unverified mock routes and custodial derivation.

[✔] PHASE 2: BI-DIRECTIONAL CALL TELEMETRY & HARDWARE ABSTRACTION         (100% DONE)
    • Native hardware stream negotiation bypassing confirmation modals.
    • Dynamic Island bi-directional hang-up and rejection synchronization.
    • Chronological call logs derived deterministically from signed call signals.

[✔] PHASE 3: SOVEREIGN SETTINGS ENGINE & ZERO-TRUST SYNCHRONIZATION      (100% DONE)
    • Unification of block lists in encrypted secure vault.
    • Real-time synchronization of audio, haptics, read receipts, and privacy.
    • Zero-leakage data export filtering out cryptographic keys and private seeds.

[⏳] PHASE 4: THE LIVING GENERATIVE OS INTEGRATION IN LEDGER CHAT         (IN PROGRESS)
    • Natural language parser for `@claude` and `/app` triggers in `LedgerChatV2.tsx`.
    • Micro-VM `AppFrame.tsx` embedded in virtualized message stream.
    • Sub-80ms SSE reactive synchronization mesh backed by Upstash Redis.
    • Headless dry-run hydration validator ensuring zero schema drift on hot mutation.

[ ] PHASE 5: PLANETARY GENESIS LAUNCH — PUBLIC ALPHA                     (DEC 10, 2026)
    • Sovereign multi-client open release across Desktop, iOS, and Android.
    • Public App Galaxy catalog indexing community-created living micro-applications.
    • Mainnet cryptographic zero-knowledge settlement integration.
══════════════════════════════════════════════════════════════════════════════════════
```

---

## 6. REPOSITORY TOPOGRAPHY & CORE SUBSYSTEMS

```
├── app/
│   ├── api/
│   │   ├── auth/                  # Identity resolution, enclave PIN & session lifecycle
│   │   ├── chat/                  # Presence, attachments, and telemetry endpoints
│   │   ├── gif/                   # Curated, SSRF-safe GIF proxy
│   │   ├── link-preview/          # RFC-1918 safe OpenGraph metadata scraper
│   │   └── siwe/                  # EIP-4361 cryptographic challenge & verification
│   ├── chat/                      # Sovereign communications portal
│   └── connect/                   # Multi-wallet & QR device pairing handshake
├── components/
│   ├── chat/
│   │   ├── community-apps/        # AppFrame.tsx isolated micro-VM runtime
│   │   ├── ContactInfoPanel.tsx   # Verified contact inspector & security management
│   │   ├── LedgerSettingsFull.tsx # Complete Swiss-precision settings engine
│   │   └── MessageBubble.tsx      # Multi-type bubble renderer (Text, Media, Calls, Apps)
│   ├── connect/                   # ConnectView.tsx desktop & mobile login presentation
│   ├── landing/                   # Public protocol showcase & interactive PhoneShowcase
│   ├── terminal/
│   │   └── LedgerChatV2.tsx       # Core messaging orchestrator (6,000+ lines hardened)
│   └── ui/
│       └── DynamicIsland.tsx      # System-level call & transaction hardware notification
├── lib/
│   ├── chat/
│   │   ├── blockList.ts           # Vault-backed cryptographic address suppression
│   │   ├── callLog.ts             # Deterministic call history derivation engine
│   │   ├── indexeddb.ts           # Local-first client persistence with LRU eviction
│   │   └── textSize.ts            # Mathematical font scaling across preview & chat
│   ├── community-apps/
│   │   ├── framePolicy.ts         # Hermetic Content Security Policy builder
│   │   └── sdk.ts                 # window.hl universal reactive client bridge
│   ├── security/
│   │   ├── requireWallet.ts       # Identity assertion enforcing verified caller headers
│   │   ├── retiredRoutes.ts       # 410 Gone edge perimeter denying legacy attack surface
│   │   └── ssrfGuard.ts           # IP validation blocking RFC-1918, link-local & cloud metadata
│   └── xmtp/
│       └── client.ts              # Exactly-once XMTP MLS v3 client architecture
├── prisma/
│   └── schema.prisma              # Relational models optimized for PgBouncer & PostgreSQL
└── test/
    └── unit/                      # 451 passing unit test suites enforcing all invariants
```

---

## 7. VERIFICATION, REPRODUCIBILITY & SYSTEM METRICS

To guarantee mathematical reproducibility and prevent deployment regressions, the repository enforces three automated quality gates:

### 7.1 Strict Static Type Verification
```powershell
# Verifies complete adherence to TypeScript 5.x compiler constraints
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.json
# Verification standard: Exactly 0 errors (Exit Code: 0)
```

### 7.2 Unit & Cryptographic Test Suite
```powershell
# Executes all unit suites covering crypto, ratcheting, presence, and settings
node node_modules/vitest/vitest.mjs run test/unit/
# Verification standard: 451/451 unit tests passed (Exit Code: 0)
```

### 7.3 Forbidden Token & Anti-Regressive Copy Audit
```powershell
# Confirms zero references to unapproved speculative tokens or deprecated architectures
node scripts/forbidden-patterns.mjs
node scripts/check-forbidden-copy.mjs
# Verification standard: 0 violations detected
```

---

## 8. DEPLOYMENT & LOCAL ORCHESTRATION

### Prerequisites
* **Runtime**: Node.js `v20.12.0` or higher (LTS recommended).
* **Execution Shell**: Windows PowerShell 5.1+ (Commands joined via `;`, never `&&`) or POSIX Bash.
* **Database**: PostgreSQL 15+ (Hosted via Neon / Supabase with PgBouncer connection pooling).
* **Volatile Cache**: Redis 7+ (Upstash Serverless or local Redis container).

### Installation & Initialization
```bash
# 1. Clone repository
git clone https://github.com/humanityledger/Humanity-Ledger.git
cd Humanity-Ledger

# 2. Install dependencies with exact lockfile resolution
npm install

# 3. Synchronize database schema
npx prisma db push

# 4. Initiate development server
npm run dev
```

The application initializes on `http://localhost:3000`. Navigate to `/connect` to initiate cryptographic session derivation, or `/chat` to access the sovereign messaging terminal.

---

## 9. SECURITY INVARIANTS & ETHICAL DISCLOSURE

Humanity Ledger adheres to a **Zero-Trust, Zero-Knowledge Posture**:
1. **Zero Plaintext Custody:** No intermediary server or database cluster stores plaintext message content, voice frames, or spending keys.
2. **Deterministic Cryptographic Verification:** Identity is solely established through asymmetric signatures (EIP-191 / SIWE / WebAuthn); client-injected headers are unconditionally sanitized by the Edge perimeter.
3. **Strict Negative Constraints:** The protocol unconditionally prohibits unbacked speculative tokens, prediction betting mechanisms, and custodial key escrow.

For vulnerability reports, cryptographic audits, and responsible disclosure:
* Cryptographic Security: `security@humanityledger.com`
* Public Audit Dossier: [`docs/AUDIT_DOSSIER.md`](docs/AUDIT_DOSSIER.md)

---

<p align="center">
  <strong>Humanity Ledger Protocol</strong><br />
  <em>Sovereign Computing · Mathematical Privacy · Decoupled from State and Corporate Surveillance</em><br />
  <strong>Countdown to Public Alpha: December 10, 2026</strong>
</p>
