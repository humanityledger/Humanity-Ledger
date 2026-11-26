# g8_admission

UltraHonk circuit for **G8 · ZKP-SP** (spec: `docs/protocol/G8_ZKPSP_SPEC.md`).

```bash
cd circuits/g8_admission
nargo test            # 4 tests: per-scope tags, wallet-free leaf, sanctions floor, honest prover
nargo compile         # target/g8_admission.json (pin its hash in lib/g8/verifier.ts)
bb write_vk -b target/g8_admission.json -o target --scheme ultra_honk
```

The TypeScript reference (`lib/g8/hash.ts`) computes the same leaf, root, scope and tag; `test/unit/g8/g8-core.test.ts` pins vectors so the two cannot drift.
