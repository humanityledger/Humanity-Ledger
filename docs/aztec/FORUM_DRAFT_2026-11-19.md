# Forum draft: four design questions (Q1, Q2, Q4, Q5)

**Stefan posts this, if he chooses to, on the Aztec forum under his own name.** The agent does not post it. It is a question from a builder. It claims no relationship with Aztec Labs, and it should not be edited to imply one. A reply is recorded verbatim in `docs/AZTEC_DECISIONS.md`.

---

**Title:** Escrow and payment stream on v6: four questions on nullifiers, keyed instances and time bounds

Hi all. I am building Ledger Chat, a messenger where a wallet is the account, with private payments on Aztec. We have two small contracts on v6.0.0, PrivateEscrow and PaymentStream. They have an internal review and no external audit, and they run on the test network. Before a closed alpha on Alpha, capped at 100 of a test token per agreement, we would value a second opinion on four design choices. The sources are open: `contracts/aztec/escrow` and `contracts/aztec/streams`.

1. **Claim before a deadline, refund after it.** `claim` and `refund` both push the same settlement nullifier, `poseidon2(escrow_id, ...)` with a domain separator, so only one can land. `claim` sets its expiration to the deadline, and `refund` checks that the deadline has passed at the anchor. A deposit nullifier over `(escrow_id, sender)` stops a second deposit from sharing the settlement path. Is this an idiomatic way to express it, or would you use something else?
2. **Keyed instances for a contract that holds private notes.** Each agreement deploys a fresh instance (universal deploy) whose public keys come from a random secret. The sender sends that secret to the recipient in an end-to-end encrypted chat message, so both PXEs can find the instance's notes. Is a keyed deployment with a secret shared by the parties the pattern you would recommend here, or is there a better one?
3. **Stream withdraw and cancel.** Withdraw and cancel consume the same per-state nullifier. Each withdrawal also delivers a copy of the next state note to the sender, so the sender can cancel later, and a cancel from a stale copy fails. We avoided `delayed_public_mutable` so the cancellation time stays private. Is this the pattern you would use?
4. **Time-dependent values in a private function.** Cancel measures accrual at its anchor block, which the sender's PXE chooses. We bound it by setting the expiration to the anchor timestamp plus 600 s, so an old anchor can withhold at most `rate × 600` from the recipient. Is there a better way to bound a time-dependent value in a private function?

Thanks for any pointers, including "read this example".
