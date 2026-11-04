# Humanity Ledger — Five-Hour Protocol Endurance Test: Specification and Target Criteria

**Document Reference:** HL-ENDURANCE-SPEC-2026.1  
**Status:** SPECIFICATION TARGET — NOT YET EXECUTED ON PRODUCTION INFRASTRUCTURE  
**Version:** 1.1  
**Date:** 2 November 2026

> [!IMPORTANT]
> This document specifies the **design and acceptance criteria** for a continuous five-hour protocol endurance
> test harness. The telemetry figures shown in Section 2 are **projected estimates** derived from per-cycle
> benchmarks measured during Testnet Stage 1 unit test runs; they are not the result of a completed five-hour
> execution on dedicated production hardware. An executed run with real timestamps and log artifacts will
> supersede this document when performed.

---

## 1. Purpose and Scope

This specification defines the continuous five-hour protocol endurance test harness designed to subject the
cryptographic, mathematical, smart contract, and sandbox layers of the Humanity Ledger protocol to
uninterrupted adversarial pressure. The harness validates that no invariant regression, memory leak, or
nullifier collision occurs under sustained high-throughput load.

The test harness is implemented in `scripts/endurance-5h-marathon.ts` and is invocable via:

```bash
npm run test:5h
```

Partial-duration smoke tests are supported:

```bash
npx tsx scripts/endurance-5h-marathon.ts --minutes=15
npx tsx scripts/endurance-5h-marathon.ts --hours=1
```

On Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-endurance-5h.ps1 -Hours 5
```

---

## 2. Live Telemetry Dashboard Format

When executing, the harness refreshes a live dashboard in the terminal every ten seconds. The following
illustrates the **expected output format** for a run at approximately 42% completion. Figures are projections
based on per-cycle benchmarks from the Testnet Stage 1 unit test suite.

```text
==============================================================================
 HUMANITY LEDGER — CONTINUOUS PROTOCOL ENDURANCE RUNNER [42.15% COMPLETED]
==============================================================================
 Elapsed Time:      2h 06m 27s / 5h 00m 00s
 Remaining Time:    2h 53m 33s
 Progress:          [============------------------] 42.15%

 Total Cycles:      ~842,500 (projected)
 Total Operations:  ~842,500,000 (projected; ~111,000 ops/sec target)
 Aztec Nullifiers:  derived continuously via Pedersen(S, salt) mod r_BN254
 MLS Epochs:        ratcheting continuously per RFC 9420 TreeKEM
 EAF Fuzz Tests:    adversarial payload stream against eaf-guard.ts
 Accounting Invar:  Claimable + Remaining ≡ TotalAllocation enforced
 Memory Sweeps:     zeroizeBuffer pass; heap sampling every cycle

 Memory Telemetry:  RSS: reported | Heap: reported (Peak: reported)
 Violations:        Target: 0 (ALL INVARIANTS SOUND)
==============================================================================
```

Detailed timestamps and cycle summaries are written continuously to:

```
reports/endurance-run-<TIMESTAMP>.log
```

---

## 3. Invariant Testing Engines

The harness executes six invariant testing engines in continuous rotation.

### Engine 1: Aztec BN254 Nullifier and Collision Fuzzer

**Invariants enforced:**

- Nullifiers are derived as $\mathrm{Pedersen}(S, \text{salt}) \pmod{r_{\text{BN254}}}$.
- Collision resistance: no two distinct pairs $(S_1, \text{salt}_1) \neq (S_2, \text{salt}_2)$ map to the
  same nullifier across the duration of the run.
- Zero leakage of spending secret from nullifier output.

### Engine 2: MLS TreeKEM Epoch Ratcheting

**Invariants enforced (RFC 9420):**

- Forward Secrecy: compromising epoch $E_N$ yields zero knowledge of epoch $E_{N+1}$ secret.
- Post-Compromise Security (PCS): each epoch advance introduces fresh entropy from the OS CSPRNG.
- Zeroization: pre-ratchet secrets are wiped via `zeroizeBuffer` immediately after the ratchet step.

### Engine 3: EAF Sandbox Adversarial Malformation Fuzzer

**Invariants enforced against `lib/security/eaf-guard.ts`:**

- Strict 8 KiB ceiling: all payloads with byte size $> 8192$ are rejected.
- Schema enforcement: any RPC call outside the frozen method catalogue is blocked.
- Identity binding: forged `memberId` fields are rejected; execution is bound to the authenticated session identity.
- Path traversal defense: malicious `appId` strings are rejected.
- Unicode bomb resistance: surrogate pair crashes and null-byte injections produce no state change.

### Engine 4: Continuous Payment Stream Monotonicity and Fund Conservation

**Invariants enforced:**

- Total Fund Conservation: $\text{Claimable} + \text{Remaining} \equiv \text{TotalAllocation}$.
- Monotonicity: for any $\Delta t > 0$, $\text{Claimable}(t + \Delta t) \ge \text{Claimable}(t)$.
- Cap Invariance: $\text{Claimable} \le \text{TotalAllocation}$ under any random rate and elapsed time up to $10^{15}$.

### Engine 5: Memory Zeroization and Heap Leak Watchdog

**Invariants enforced:**

- `zeroizeBuffer` wipes all bytes to `0x00` with zero residual entropy.
- Heap sampling monitors `process.memoryUsage().rss` and `heapUsed`. An unbounded monotone increase
  triggers an alert and log entry flagging a probable closure capture or memory leak.

### Engine 6: Interleaved Full Battery Sweeps

**Cadence:** every 30 minutes, an automated trigger invokes the complete test battery
(`npm run test:run`, 1,338 tests in CI on 4 Nov 2026) to confirm that sustained system stress introduces zero state
regressions into the main test suite.

---

## 4. Progress Monitoring

### Bash / Linux / macOS / WSL

```bash
# Tail live log output:
tail -f reports/endurance-run-*.log

# Check process status:
ps aux | grep endurance-5h
```

### Windows PowerShell

```powershell
# Tail live log output:
Get-Content reports/endurance-run-*.log -Wait -Tail 30

# Check running process:
Get-Process | Where-Object { $_.ProcessName -like "*node*" }
```

---

## 5. Acceptance Criteria for Certification

A completed run is considered certified if and only if all of the following conditions hold:

| Criterion | Required Value |
|---|---|
| Total invariant violations | Exactly `0` |
| RSS memory growth | Bounded; peak heap does not increase monotonically without bound |
| Total operations | Exceeds $10^8$ |
| Nullifier collisions (BN254) | Exactly `0` |
| EAF breakouts | Exactly `0` |
| MLS epoch errors | Exactly `0` |
| Fund conservation failures | Exactly `0` |

Upon satisfaction of all criteria, the harness emits a final log entry:

```text
STATUS: ENDURANCE RUN COMPLETE — ALL INVARIANTS VERIFIED FOR DURATION <duration>
Timestamp: <ISO-8601>
Log artifact: reports/endurance-run-<TIMESTAMP>.log
```

> [!NOTE]
> This certification statement records completion of the specified test duration on the hardware and
> configuration described in the log artifact. It does not constitute a claim of production readiness.
> Mainnet deployment readiness is governed by the criteria defined in `docs/STATUS.md`.
