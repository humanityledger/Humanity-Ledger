# Humanity Ledger — Incident Response Playbook
**Version 1.0 — 2026-10-31**  
**Classification**: NORMATIVE  
**Authority**: `docs/PROTOCOL_SPEC.md` §6 (Threat Model P1–P6)

---

## Preamble

This playbook defines the response procedures for the four principal incident classes in the Humanity Ledger threat model. All private state, identity claims, and value-bearing operations remain client-side UltraHonk proofs. No server-side key custody exists — this shapes every response procedure.

**Response SLA**: All CRITICAL actions in Sections 1–4 must be initiated within **1 hour** of confirmed detection.

---

## Incident Class 1: Compromised Device (P1 — User Device Compromise)

**Threat**: Adversary gains access to a user's device containing Aztec EmbeddedWallet key material or XMTP device identity.

### Detection Signals
- User reports unexpected transactions or message decryption
- Canary tripwire fires (`lib/security/canary.ts` breach detector)
- Unusual session from unknown IP/device via auth provider

### Response Steps

| Step | Action | Owner | Time Target |
|---|---|---|---|
| 1 | User triggers "Revoke this device" in account settings | User | T+0 |
| 2 | MLS device removal: client sends `Remove` proposal to group, members Commit | Client | T+5 min |
| 3 | MLS epoch advances — old device loses forward-decryption ability | Protocol | T+10 min |
| 4 | Aztec note migration: user generates new EmbeddedWallet, re-deposits via new nullifier | User | T+15 min |
| 5 | Revoke all active sessions in auth provider (Clerk session invalidation) | User/Admin | T+20 min |
| 6 | If server-side canary was breached: log scrub audit per RISK-01 | Admin | T+30 min |
| 7 | Post-incident review: document timeline in `docs/postmortems/` | Protocol Lead | T+48h |

### Invariants Preserved
- **P1 (Client-Side Custody)**: New wallet keys are CSPRNG-derived on the replacement device. No server ever holds key material.
- **P3 (Forward Secrecy)**: MLS epoch advance ensures the compromised device cannot decrypt future messages.
- **Aztec Notes**: Notes belonging to the old nullifier are abandoned; user re-creates value under new key.

---

## Incident Class 2: Compromised Verification Key (Circuit VK Integrity)

**Threat**: A VK registered on-chain does not match the intended circuit, or a malicious VK has been queued via the `HumanityTimeLockVault` timelock.

### Detection Signals
- `VK_MONITORING.md` on-chain listener fires a mismatch alert within 60 seconds
- Client VK hash assertion (`lib/aztec/verifier.ts`) fails on wallet init
- Community reports accepting proofs from an unexpected circuit version

### Response Steps

| Step | Action | Owner | Time Target |
|---|---|---|---|
| 1 | Confirm mismatch: compare `keccak256(registered_vk)` vs `circuits/*/target/*.vk.json` hash | Protocol Lead | T+0 |
| 2 | Queue `DEPRECATED` status on affected VK registry entry (14-day timelock begins) | Admin Multisig | T+1h |
| 3 | Broadcast public notice: GitHub advisory + in-app banner `[VK DEPRECATION NOTICE]` | Protocol Lead | T+2h |
| 4 | Compile replacement circuit with `nargo compile` on a clean, air-gapped machine | Circuit Engineer | T+24h |
| 5 | Audit replacement VK: independent verification by second engineer | Reviewer | T+48h |
| 6 | Queue new VK on `HumanityTimeLockVault` (14-day timelock begins for replacement) | Admin Multisig | T+72h |
| 7 | Update `circuits/*/target/*.vk.json`, `docs/CIRCUITS.md`, `TRACEABILITY_MATRIX.md` | Engineer | T+72h |
| 8 | After 14 days: execute VK replacement on-chain | Admin Multisig | T+14d |
| 9 | Mark old VK as `RETIRED` — clients must not construct proofs using it | Protocol | T+14d |

### Client Behavior During VK Transitions
- **DEPRECATED**: Client shows warning banner. User can still prove but is urged to migrate.
- **RETIRED**: Client blocks proof construction. UI shows migration path to new circuit.
- Reference: `docs/PROTOCOL_SPEC.md` §8

---

## Incident Class 3: Suspected Server Breach (P5 — Server-Side Compromise)

**Threat**: Unauthorized access to the Next.js/Railway server, database, or infrastructure. Note: no private keys are server-held, but metadata and session data may be at risk.

### Detection Signals
- Canary key accessed without authorization (`lib/security/canary.ts`)
- Anomalous database queries or exports detected
- Auth provider logs show admin login from unexpected location
- Dependency in `package.json` tampered (supply-chain attack vector)

### Response Steps

| Step | Action | Owner | Time Target |
|---|---|---|---|
| 1 | Activate `LedgerDeadmanSwitch` if protocol-level freeze warranted | Admin Multisig | T+0 |
| 2 | Rotate all server-side credentials: database, Redis, Railway API keys, Clerk secret | Admin | T+15 min |
| 3 | Run canary check: `lib/security/canary.ts` full audit | Admin | T+30 min |
| 4 | Log scrub audit: confirm no private key material in Railway logs, error logs, or database | Admin | T+1h |
| 5 | Revoke all active user sessions (Clerk mass session invalidation) | Admin | T+1h |
| 6 | Notify affected users: "Security event — please reconnect your wallet" | Protocol Lead | T+2h |
| 7 | `npm audit` + `npx tsx scripts/verify-l1-bytecode.ts` to verify no dependency tampering | Engineer | T+2h |
| 8 | Reproduce incident in isolated staging; document root cause | Engineer | T+48h |
| 9 | Publish postmortem in `docs/postmortems/YYYY-MM-DD-server-breach.md` | Protocol Lead | T+72h |

### Invariants Preserved
- **P5 (Server Compromise)**: Server holds no Aztec private keys, no MLS leaf secrets. User funds and private note state are unaffected.
- **Canary**: Breach of canary key (`lib/security/canary.ts`) is detectable without knowing the key value.

---

## Incident Class 4: Sequencer Censorship (P6 — Aztec Sequencer Censorship)

**Threat**: The Aztec sequencer refuses to include a user's transaction (targeted censorship or network fault).

### Detection Signals
- User transaction not included after >60 seconds
- Client detects: response from `aztec-testnet.drpc.org` returns pending status repeatedly
- Network-level monitoring shows inclusion time outlier (p95 breached)

### Response Steps

| Step | Action | Owner | Time Target |
|---|---|---|---|
| 1 | Client shows "Resubmit" button after 60s timeout (per `docs/SEQUENCER_RESILIENCE.md`) | Client | T+60s |
| 2 | User clicks Resubmit — client retries with same witness/proof (idempotent, same nullifier) | Client | T+65s |
| 3 | If retry fails: client switches to alternative RPC endpoint (fallback list in `SEQUENCER_RESILIENCE.md`) | Client | T+120s |
| 4 | If all RPC endpoints unavailable: user retains client-side witness; no state loss | Client | T+180s |
| 5 | If censorship is targeted/persistent: escalate to Aztec Labs via GitHub issue | Protocol Lead | T+1h |
| 6 | Explore L1 direct submission path (Aztec "escape hatch" mechanism) | Engineer | T+4h |
| 7 | Document event; assess whether `LedgerDeadmanSwitch` activation is warranted | Protocol Lead | T+24h |

### Invariants Preserved
- **P6 (Censorship Resistance)**: Private witnesses are retained client-side. No user state loss due to sequencer censorship.
- **Nullifier Uniqueness**: Resubmitting the same transaction is safe — nullifier prevents double-spend.

---

## 5. Communication Templates

### 5.1 VK Deprecation Notice (in-app banner)
```
⚠️ CIRCUIT UPDATE: A verification key update has been queued for the [escrow/streams/identity] 
circuit. Your existing proofs remain valid for 14 days. Please update the app before [DATE] 
to continue transacting. Contact support if you need assistance.
```

### 5.2 Server Security Event Notice (email/in-app)
```
SECURITY NOTICE: We detected unusual activity on our servers on [DATE]. 
No private keys or proof witnesses were exposed (these are held exclusively on your device). 
As a precaution, please reconnect your wallet. If you see unexpected activity, 
contact support immediately.
```

---

## 6. Post-Incident Review Requirements

Every incident must produce:
1. A postmortem in `docs/postmortems/YYYY-MM-DD-[type].md`
2. An updated residual risk entry in `docs/AUDIT_DOSSIER.md` if the incident reveals a new risk
3. A regression test added to the relevant test suite to prevent recurrence
4. An entry in the next monthly review (see `docs/AUDIT_DOSSIER.md` §Monthly Review)

---

## 7. Contact & Escalation

| Role | Contact Method |
|---|---|
| Protocol Lead | GitHub issue tagged `security-incident` |
| Admin Multisig | Hardware wallet holders (3-of-5 threshold) |
| Aztec Labs | `https://discord.gg/aztec` + GitHub issue |
| Immunefi Bug Bounty | `docs/BUG_BOUNTY.md` |
