# Humanity Ledger — 5-Hour Continuous Protocol Endurance & Invariant Marathon
## Extreme Stability, Memory Leak Surveillance & Deep Fuzzing Specification
**Version 1.0 — Sovereign Endurance Baseline**

> **Purpose**: This specification details the continuous 5-hour protocol endurance test harness designed to subject every cryptographic, mathematical, smart contract, and sandbox layer of the Humanity Ledger protocol to uninterrupted, high-throughput adversarial pressure (surpassing 100,000,000+ operations) to prove zero memory leaks, zero invariant regressions, and absolute stability.

---

## 1. Quick Start — Launching the 5-Hour Marathon

### Option A: The Universal npm Command (Cross-Platform)
```bash
npm run test:5h
```

### Option B: Bash Runner (Linux / macOS / WSL / Git Bash)
```bash
# Foreground with live dashboard:
bash scripts/run-endurance-5h.sh 5

# Detached background (runs uninterrupted even if terminal closes):
nohup bash scripts/run-endurance-5h.sh 5 > reports/endurance-daemon.log 2>&1 &
```

### Option C: Windows PowerShell
```powershell
# Foreground with live dashboard:
powershell -ExecutionPolicy Bypass -File scripts/run-endurance-5h.ps1 -Hours 5

# Or running in a background job:
Start-Job -ScriptBlock { Set-Location $using:PWD; npx tsx scripts/endurance-5h-marathon.ts --hours=5 }
```

### Option D: Direct In-Line CLI Command
```bash
npx tsx scripts/endurance-5h-marathon.ts --hours=5
```
*(You can also run smoke tests of any custom duration, e.g. `--minutes=15` or `--hours=1`)*.

---

## 2. Real-Time Telemetry Dashboard

While executing, the marathon refreshes a live dashboard in the terminal every 10 seconds:

```text
==============================================================================
 HUMANITY LEDGER — CONTINUOUS PROTOCOL ENDURANCE RUNNER [42.15% COMPLETED]
==============================================================================
 Elapsed Time:      2h 06m 27s / 5h 00m 00s
 Remaining Time:    2h 53m 33s
 Progress:          [============------------------] 42.15%

 Total Cycles:      842,500
 Total Operations:  842,500,000 (111,042 ops/sec)
 Aztec Nullifiers:  210,625,000 (0 collisions detected in BN254)
 MLS Epochs:        84,250,000 (Current Epoch: #84250001)
 EAF Fuzz Tests:    126,375,000 (0 breakouts, 0 size violations)
 Accounting Invar:  252,750,000 (100% fund conservation)
 Memory Sweeps:     168,500,000 (100% clean zeroization)

 Memory Telemetry:  RSS: 274.1 MB | Heap: 92.4 MB (Peak: 94.0 MB)
 Violations:        0 (ALL INVARIANTS SOUND)
==============================================================================
```

All detailed timestamps and cycle summaries are saved continuously to:
```text
reports/endurance-run-<TIMESTAMP>.log
```

---

## 3. The 6 Invariant Testing Engines Running Continuously

The marathon engine [`scripts/endurance-5h-marathon.ts`](file:///C:/Users/Grati/Documents/GitHub/Humanity-Ledger/scripts/endurance-5h-marathon.ts) executes continuous cycles across 6 protocol domains:

### Engine 1: Aztec BN254 Nullifier & Collision Fuzzer
- **Operations**: Hundreds of millions of unique cryptographic derivations.
- **Invariants Enforced**:
  - Nullifiers are derived via $\mathrm{Pedersen}(S, \text{salt}) \pmod{r_{\text{BN254}}}$.
  - Collision resistance: Asserts that no two distinct pairs $(S_1, \text{salt}_1) \neq (S_2, \text{salt}_2)$ map to the same nullifier across the entire 5-hour duration.
  - Zero leakage of spending secret from nullifier output.

### Engine 2: MLS TreeKEM Million-Epoch Ratcheting
- **Operations**: Over 50,000,000 continuous epoch transitions.
- **Invariants Enforced**:
  - RFC 9420 Forward Secrecy: Compromising epoch $E_N$ yields zero knowledge of epoch $E_{N+1}$ secret.
  - Post-Compromise Security (PCS): Each epoch advance introduces fresh entropy from OS CSPRNG.
  - Zeroization: Pre-ratchet secrets are wiped immediately via `zeroizeBuffer` to prevent retention in garbage collector generation pools.

### Engine 3: EAF Sandbox Adversarial Malformation Fuzzer
- **Operations**: Continual barrage of hostile payloads against [`lib/security/eaf-guard.ts`](file:///C:/Users/Grati/Documents/GitHub/Humanity-Ledger/lib/security/eaf-guard.ts).
- **Invariants Enforced**:
  - Strict 8 KB ceiling: Rejects 100% of payloads with byte size $> 8192$.
  - Undeclared methods: Blocks any RPC call outside the frozen schema.
  - Identity spoofing defense: Rejects forged `memberId` fields, strictly binding execution to authentic session identity.
  - Path traversal defense: Blocks malicious `appId` strings (e.g. `../../etc/passwd`).
  - Unicode bomb resistance: Immune to surrogate pair crashes and null-byte injections.

### Engine 4: Continuous Payment Stream Monotonicity & Fund Invariance
- **Operations**: Hundreds of millions of randomized accrual simulations.
- **Invariants Enforced**:
  - Total Fund Conservation: $\text{Claimable} + \text{Remaining} \equiv \text{TotalAllocation}$.
  - Monotonicity: For any $\Delta t > 0$, $\text{Claimable}(t + \Delta t) \ge \text{Claimable}(t)$.
  - Cap Invariance: $\text{Claimable} \le \text{TotalAllocation}$ under any random rate and elapsed time up to $10^{15}$.

### Engine 5: Memory Zeroization & Heap Leak Watchdog
- **Operations**: Continuous buffer allocation, wiping, and heap sampling.
- **Invariants Enforced**:
  - `zeroizeBuffer` wipes 100% of bytes to `0x00`. Zero residual entropy.
  - Leak detection: Samples `process.memoryUsage().rss` and `heapUsed`. If heap grows continuously without bounding (indicating a memory leak or closure capture), the test alerts and logs RSS drift.

### Engine 6: Periodic Interleaved Full Battery Sweeps
- **Cadence**: Every 30 minutes, an automated trigger can execute the complete 60,300+ test battery (`scripts/run-all-tests.sh` or `npm run test:massive`) in parallel to confirm that long-running system stress introduces zero state regressions.

---

## 4. How to Inspect Live Progress or Background Daemons

### In Bash / Linux / macOS / WSL:
```bash
# View live tail of the log file:
tail -f reports/endurance-run-*.log

# Check if the process is running:
ps aux | grep endurance-5h
```

### In Windows PowerShell:
```powershell
# View live tail of log file:
Get-Content reports/endurance-run-*.log -Wait -Tail 30

# Check running process:
Get-Process | Where-Object { $_.ProcessName -like "*node*" }
```

---

## 5. Certification of 5-Hour Completion

At the conclusion of the 5-hour run, the runner validates:
1. **Total Invariant Violations**: Must be strictly `0`.
2. **RSS Memory Growth**: Must remain bounded (Peak Heap $< 250\text{ MB}$, no unbounded heap climb).
3. **Operations Completed**: Exceeds $100,000,000$ operations.
4. **Final Certification**:
   ```text
   STATUS: PROTOCOL MAXIMUM RESILIENCE & FLUIDITY CERTIFIED FOR PRODUCTION
   ```
