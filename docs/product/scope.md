# Humanity Ledger — Product Scope Definition (I-028)

## 1. Core Architecture (Production)
The production core of Humanity Ledger is strictly focused on sovereign privacy:
- **Direct Messaging**: 1:1 end-to-end encrypted messaging powered by the XMTP protocol. Server stores zero plaintext message content.
- **Communities**:
  - *Private Communities*: XMTP MLS end-to-end encrypted groups.
  - *Public Communities*: Explicitly marked "Public & Unencrypted", stored in database with strict membership authorization and pagination.
- **Identity & Authentication**: Session-only authentication (`requireWallet()`) via SIWE (Sign-In with Ethereum) and hardware-bound tokens. Zero trust in client-sent identity headers.
- **Voice & Calls**: Group and 1:1 audio calls with WebRTC/LiveKit and dedicated TURN infrastructure.

## 2. Experimental / Feature-Flagged Modules
- **Aztec Private Transfers**: Private payments using Aztec testnet. Guarded by `NEXT_PUBLIC_ZK_MODE=testnet` and transfer volume limits. Mainnet requires external formal contract audits (H-037).
- **ZK Escrow & Invoices**: Experimental Noir contracts, disabled by default.

## 3. Retired / Demo Modules
Non-core peripheral modules (Terminal, Omni-Matrix, Forge, Academy) are gated behind feature flags (`lib/flags.ts`) and labeled with `<DemoBadge />`.
