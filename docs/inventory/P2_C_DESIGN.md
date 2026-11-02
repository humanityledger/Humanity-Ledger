# P2-C Migration Design Specification

## 1. Goal
Design the structured rollout of the `HumanityIdentity` (SIWE) and unified architecture across all remaining Mini-Apps, replacing the legacy email/password identity layer.

## 2. Core Primitives
### 2.1 Identity & Session
- **Canonical Identity:** `HumanityIdentity` (mapped 1:1 with EIP-55 EVM addresses).
- **Session:** `HumanitySession` governed by ADR 004 (Hybrid Edge JWT + Authoritative DB).
- **Legacy Fallback:** Supported strictly via the `Compatibility Layer` until 100% adoption.

### 2.2 Permissions
- Transition from ad-hoc route checks to `RoleBasedAccessControl` mapped directly to `HumanityIdentity`.
- Enclaves and specific Mini-Apps define required scopes in their manifests.

### 2.3 Network & Asset
- **Network:** Shared Aztec Mainnet (RPC: `AZTEC_TESTNET_RPC`).
- **Asset / Proof:** SNARK/STARK commitments and Golden Tickets tied definitively to `HumanityIdentity.id` rather than legacy user IDs.

## 3. Mini-App Manifests
Each Mini-App must define a manifest (e.g., `app/studio/manifest.json`) declaring its identity constraints:
```json
{
  "app_id": "studio",
  "requires_identity": true,
  "supported_methods": ["SIWE"],
  "required_scopes": ["studio:read", "studio:write"],
  "feature_flag": "NEXT_PUBLIC_IDENTITY_SIWE_STUDIO_ENABLED"
}
```

## 4. Rollout Strategy
### 4.1 Feature Flags
Migration rollout is strictly controlled by environment feature flags:
- `OFF`: Legacy identity system active.
- `SHADOW`: SIWE runs in parallel. State is mirrored but not authoritative.
- `PILOT`: Enforced for a subset of beta users.
- `LIVE`: SIWE enforced for all users. Legacy system blocked.

*Note: Feature flags only control UX rollout, never authorization logic. Server routes must enforce security regardless of flags.*

### 4.2 Compatibility Layer
During transition, the Hub will support a split-brain architecture.
- `middleware.ts` extracts BOTH `humanity_session` and legacy tokens.
- API endpoints map `userId` to `identityId` dynamically to prevent breaking legacy frontend apps.

### 4.3 Rollback
If a critical flaw is detected in a newly migrated Mini-App:
1. Turn feature flag to `OFF`.
2. Middleware reverts to legacy extraction priority.
3. Because data relationships (e.g., `Transaction -> userId`) are preserved during the dual-write phase, no data is lost.

## 5. Observability
Before migrating the second pilot, Datadog/Sentry must capture:
- SIWE success/failure rates.
- Legacy auth usage.
- Session revocation events (DB hits).
- Feature flag fallback activations.
*Crucial: No PII, private keys, or raw JWTs are logged.*

## 6. Migration Sequence & Second Pilot
The dependency graph (see `P2_C_MIGRATION_GRAPH.md`) dictates the order. We do NOT migrate the entire Hub at once.
- **Pilot 1 (Completed):** Registry (Public Read heavy, low mutation risk).
- **Pilot 2 (Target):** To be selected based on exerting a different architectural boundary (e.g., `Studio` for heavy state mutations or `Portfolio` for financial reads).

The final sequence is calculated based on dependency depth, identity coupling, and security risk.
