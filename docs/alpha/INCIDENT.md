# Closed alpha: incident procedure

## When this applies

Use this procedure for any of these:
- a report or alert that funds moved where they should not have, or cannot be settled;
- a refusal that should not happen;
- an escrow or stream that cannot be claimed, refunded, withdrawn or cancelled;
- any critical finding in PrivateEscrow or PaymentStream.

The contracts have no external audit (OD-10).

## First hour

1. **Close the entrance.** Set `closedAlpha.enabled: false` in `deployments/aztec-mainnet.json` and deploy. New agreements are refused at once. Settling existing ones stays possible: the classes have no admin and no pause, so nothing can freeze them.
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
