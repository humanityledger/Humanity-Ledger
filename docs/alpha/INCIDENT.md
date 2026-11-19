# Closed alpha: incident procedure

## When this applies

Use this procedure for any of these:
- a report or alert that funds moved where they should not have, or cannot be settled;
- a refusal that should not happen;
- an escrow or stream that cannot be claimed, refunded, withdrawn or cancelled;
- any critical finding in PrivateEscrow or PaymentStream.

The contracts have no external audit (OD-10).

## First hour

1. **Close the entrance.**
   - **Fastest (Stefan, Railway):** set `AZTEC_VALUE_MODE=exits-only` on the web service. Every new value action (send, issue, opening or accepting an agreement) asks the server first (`lib/aztec/value-mode.ts`) and is refused from the next attempt, with no deploy needed.
   - **Then:** set `closedAlpha.enabled: false` in `deployments/aztec-mainnet.json`, in a PR Stefan merges.
   - Settling existing agreements stays possible. `actOnAgreement` (claim, refund, withdraw, cancel) does not ask the value mode, and the classes have no admin and no pause, so nothing can freeze them.
2. **Tell the testers.**
   - What happened, in one sentence.
   - That opening new agreements is closed.
   - That existing agreements can still be settled, and how.
   - Do not ask anyone to send funds anywhere.
3. **Write down** in a new `docs/alpha/incidents/<date>.md`:
   - the time;
   - the transaction hashes and blocks involved (from the explorer or the tester, never invented);
   - the class ids;
   - what was observed.

## Next

4. **Reproduce on the test network** with the same class, and write a TXE test that fails the same way.
5. **Fix in a new class.** A fix is a class change: new class id, the old one moved to history in the records, a new Alpha deployment by Stefan, and the gate pointed at the new class.
6. **Decide** whether to reopen. Only Stefan reopens, in writing, in `docs/alpha/OPERATOR_DECISIONS.md`.

## Rehearsal

The procedure must be rehearsed once on the test network before the first invitation:
- close the gate;
- confirm that an open escrow can still be refunded and a stream cancelled;
- reopen.

The rehearsal date and transaction hashes are recorded here.

| Rehearsal | Date | Transactions |
|---|---|---|
| Test network | not yet run | — |

### Drill 1: tabletop, 19/11/2026 (package 6)

This was run by the agent against the code and documents only. **No transaction was sent and no switch was changed.**

| Step | Checked against | Result |
| --- | --- | --- |
| Detect | `/api/status/alpha`, `/status` and the "Alpha alerts" workflow (every 30 min) | Payment failures above 10 % of 5 or more attempts, send failures above 5 % of 20 or more reports, and a node whose block number has not moved for 10 min all raise an alert (`test/unit/ops/alerts.test.ts`). |
| Close (fast) | `assertNewValueAllowed` in `lib/aztec/wallet/client.ts` and `lib/aztec/chat-agreements.ts` | Send, issue, deploy, open and accept ask the server mode. `actOnAgreement` does not, so exits stay open. |
| Close (record) | `lib/alpha/gate.ts` | **Finding:** `closedAlphaDecision` (enabled, until, member, risk acknowledgement) was not called by any opening path. Only the recorded-deployment check in `checkAgreementPolicy` applied. Fixed in package 7: the gate is enforced before an agreement is opened on Alpha. |
| Settle | TXE tests: refund at the maximum, cancel never refused, withdrawal after cancel refused | Covered in `contracts/aztec/*/src/test.nr`. |
| Record | `docs/alpha/incidents/<date>.md` | Template steps above. |

**Still to do (testnet drill):** close, refund an open escrow, cancel a stream, then reopen. Record the transaction hashes here from the "Aztec escrow e2e" run, which is queued.

