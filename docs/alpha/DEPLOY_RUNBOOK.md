# Closed alpha, wave 1: deployment runbook

These are the steps to put PrivateEscrow and PaymentStream (the closed-alpha classes, OD-1, OD-2 and OD-7) on Aztec Alpha.

**Stefan runs every step that sends a transaction, with his own keys.** No agent holds a key, signs or broadcasts. After each transaction, Stefan gives the agent the transaction hash and the block. The agent records them.

## 0. Before anything

- [ ] Phase 0 exit criteria hold (`docs/audit/INTERNAL_SECURITY_REVIEW_2026-11-18.md` §7).
- [ ] `docs/alpha/OPERATOR_DECISIONS.md` is signed (it was, on 18/11/2026).
- [ ] The lawyer's note and the testers' terms exist (OD-8) before the first invitation code is created.
- [ ] In `deployments/aztec-testnet.json`, the current classes are PrivateEscrow `0x165090de…f143` and PaymentStream `0x0f2ba459…c1e3`. They are listed again in `deployments/aztec-mainnet.json` under `closedAlpha.classes`.
- [ ] `ALPHA_INVITE_PEPPER` (32 characters or more, random) and `ALPHA_ADMINS` (Stefan's wallet) are set in Railway.
- [ ] `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS` for HLC is `100000000`, which is 100 HLC (OD-2). The client never allows more than 100 HLC anyway.

## 1. Test network first

1. Deploy one escrow and one stream with the current classes between two accounts that are not the operator's. Use `scripts/aztec/deploy-keyed.ts`, or open them from Ledger Chat on the test network.
2. Run a claim, a refund after the deadline, a stream withdrawal and a cancel.
3. Record each transaction and block in `deployments/aztec-testnet.json` (`e2eRuns`). The "Aztec escrow e2e" workflow runs steps 1 and 2 with throwaway accounts; its run id goes in the same entry.

## 2. Read-only preflight on Alpha

1. Run the "Aztec mainnet preflight" workflow. It only reads: it confirms the network (L1 chain 1, rollup version), the node, and that the artifacts match the class ids.
2. Do not continue if it is red.

## 3. Publish the classes on Alpha (Stefan)

The gate (`lib/alpha/gate.ts`) opens an agreement only for a class that is in `closedAlpha.classes` **and** recorded as deployed in `contracts`. An account must also be an active member. So the classes are published before the gate opens, and not by the first agreement.

1. With your own account and tools, publish the PrivateEscrow and PaymentStream classes from the committed artifacts. Use `contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json` and `contracts/aztec/streams/target/payment_stream-PaymentStream.json`, the artifacts that `test/unit/aztec/wave1-classes.test.ts` ties to `closedAlpha.classes`.
2. Give the agent the transaction hash and the block of each publication.
3. The agent adds each class to `contracts` in `deployments/aztec-mainnet.json` with these fields:
   - `classId`, `deployTx` and `deployBlock`;
   - `tracksCurrentArtifact: true`;
   - the run id of the preflight that saw the class published.
4. Run the preflight again. It must report both classes as published.
5. Check on the explorer that each class id matches the record.

## 4. Open the gate (Stefan's PR)

The agent prepares this as a PR, and Stefan merges it:

- `closedAlpha.enabled: true`;
- `closedAlpha.until`: 8 weeks from the first publication (OD-9).

Without both, every new agreement is refused. The exits (claim, refund, withdraw, cancel) are never gated.

## 5. Invitations

Follow `FIRST_CODE_CHECKLIST.md`. Then, one code per tester, after the two checks:

```
node scripts/alpha/invites.mjs create --by 0x<Stefan's wallet> --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked --days 14
```

- Each code is printed once. Hand it over in person or through a private channel. At most 50 testers (OD-4, amended 19/11/2026).
- Stefan's own test account needs a code too: the gate has no operator exception.
- To revoke a tester, run `node scripts/alpha/invites.mjs revoke-member 0x…`. That tester can still settle (claim, refund, withdraw, cancel) but cannot open new agreements.

## 6. End of the alpha

1. On `until`, the gate refuses new agreements by itself. Existing agreements can still be settled.
2. Set `closedAlpha.enabled: false`.
3. Write a summary: testers, agreements, incidents and the Fee Juice spent, against OD-9's 400 AZTEC.
