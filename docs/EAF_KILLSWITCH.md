# Humanity Ledger — Ephemeral Application Framework (EAF) Emergency Kill-Switch Runbook
**Version 1.0 — 2026-10-31**  
**Classification**: OPERATIONAL SECURITY RUNBOOK  
**Authority**: `docs/PROTOCOL_SPEC.md` §6 Invariant P6 (EAF Air-Gap Isolation), `docs/FORTIFICATION_CHECKLIST.md` Items 111–140

---

## 1. Overview & Architecture

The **Ephemeral Application Framework (EAF)** hosts community mini-apps inside sandboxed `<iframe>` contexts with null-origin isolation:

```
┌─────────────────────────────────────────────────────────────┐
│                    Host Browser Window                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ EAF Guard (lib/security/eaf-guard.ts)                 │  │
│  │ - 8 KB hard payload ceiling                           │  │
│  │ - Session memberId injection (anti-spoofing)          │  │
│  │ - Method allowlist: ping, getState, setState, proof   │  │
│  │ - Emergency Kill Switch: globalEafDisabled            │  │
│  └──────────────────────────▲────────────────────────────┘  │
│                             │ postMessage (JSON-RPC)        │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │ Sandboxed Mini-App iframe                             │  │
│  │ CSP: default-src 'none'; connect-src 'none';          │  │
│  │ Sandbox: allow-scripts (NO allow-same-origin)         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

The **Emergency Kill Switch** (`setEafKillSwitch(true)`) instantaneously disables all bridge communication across all frames, causing every incoming and outgoing message to be discarded with zero state mutation.

---

## 2. Trigger Conditions (When to Activate)

The kill switch MUST be engaged immediately upon detection of any of the following:

| Trigger | Indicator | Severity | SLA |
|---|---|---|---|
| **EAF Escape Attempt** | `[EAF_REJECTION] reason=undeclared_method` spike (> 10 / min) | CRITICAL | < 5 min |
| **Path Traversal in appId** | `[EAF_REJECTION] reason=invalid_app_id` detected | HIGH | < 10 min |
| **State Tampering** | Member ID forgery or storage collision detected across apps | CRITICAL | < 5 min |
| **Browser Zero-Day** | Public advisory regarding WebKit / Chromium iframe sandbox breakout | CRITICAL | Immediate |
| **Payload Flood / DoS** | Sustained > 8 KB payload rejection bursts | HIGH | < 15 min |

---

## 3. Activation Procedures

### 3.1 Method A: Runtime In-Memory Tripwire (Instantaneous)

In the host application context:

```typescript
import { setEafKillSwitch, isEafGloballyDisabled } from '@/lib/security/eaf-guard';

// Activate kill switch
setEafKillSwitch(true);

console.assert(isEafGloballyDisabled() === true, 'EAF Kill Switch is ACTIVE');
```

When active, all calls to `validateEAFBridgeMessage` immediately log:
```
[EAF_REJECTION] reason=kill_switch appId=unknown method=unknown
```
and return `{ valid: false, error: 'EAF execution disabled globally by emergency kill switch' }`.

### 3.2 Method B: Environment Variable Flag (Persistent Across Restarts)

Set the following variable in the host hosting environment (Railway / Docker / Kubernetes):

```bash
EAF_EMERGENCY_DISABLED=true
```

Upon server boot or worker instantiation, `lib/security/eaf-guard.ts` defaults `globalEafDisabled` to `true`.

### 3.3 Method C: Client UI Tear-Down

When the kill-switch state is broadcast via WebSocket or server session flag:
1. All active `<iframe data-eaf="true">` elements are unmounted from the DOM.
2. The user sees a security banner:
   ```
   [SECURITY NOTICE] Third-party community applications have been temporarily
   paused for maintenance. Your wallet balances and private state are unaffected.
   ```

---

## 4. Operational Verification

To verify that the kill-switch is actively suppressing executions:

```bash
# Run the automated fortification test suite (Item 128 tests the kill switch)
npx vitest run test/fortification.test.ts -t "Global kill switch"
```

Expected output:
```
✓ Item 128: Global kill switch disables all EAFs instantly (1 ms)
```

---

## 5. Containment, Investigation & Recovery

1. **Containment**: Kill switch engaged. Frames unmounted.
2. **Telemetry Review**:
   - Inspect Railway logs for `[EAF_REJECTION]`.
   - Identify the offending `appId` and message payload characteristics.
3. **Quarantine**:
   - If a specific app is malicious, remove its manifest from the app directory.
   - Update `allowedMethods` or add app-specific revocation in `lib/security/eaf-guard.ts`.
4. **Reactivation**:
   ```typescript
   setEafKillSwitch(false);
   ```
5. **Postmortem**:
   - File incident report in `docs/postmortems/YYYY-MM-DD-eaf-killswitch.md`.
   - Update `docs/AUDIT_DOSSIER.md` residual risk register if new attack vectors are identified.

---

## 6. Verification Checklist

- [ ] `lib/security/eaf-guard.ts` exports `setEafKillSwitch` and `isEafGloballyDisabled`.
- [ ] Automated test `test/fortification.test.ts` passes.
- [ ] Host-side CSP enforces `connect-src 'none'`.
- [ ] No private keys or Aztec seeds are accessible to the iframe context.
