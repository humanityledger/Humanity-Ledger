# G6 / R-11: two-account session checklist (no code; real browsers, testnet first)

Two accounts, A and B, with different EVM wallets, each signed in with SIWE in its own browser: desktop Chrome plus Safari iOS, then Chrome Android. Use real XMTP and a real Aztec node, nothing simulated, and no keyless or do-not-use instance. Record each transaction hash and block, plus a screen recording, in `deployments/aztec-testnet.json` (`e2eRuns`).

| # | Step | Expect |
| --- | --- | --- |
| 1 | A and B open the private wallet and share their Aztec address (v2, signed) in the DM | Each card says "verified" (fresh G7 check in `verifiedPeerBinding`) |
| 2 | A sends B a direct private payment from the composer | Message carries a 0x…64 hash and the explorer link; on Alpha it says the fee is paid publicly; B's balance rises |
| 3 | A opens an escrow; B verifies and accepts | B's card is confirmed, every field equals the stored note |
| 4 | B claims before the deadline | A's card reads settled |
| 5 | A opens a second escrow; B lets it expire; A refunds | Refund lands, claim after deadline refused |
| 6 | A opens a stream; B withdraws; A cancels | Withdrawal ≤ accrued, cancel by A, withdrawal after cancel refused |
| 7 | A shares a different Aztec address | B sees a conflict warning and the old pin is kept. After confirming with A outside the chat, B repins; the new pin counts as verified only once A's signed (v2) announcement for it arrives |
| 8 | Alpha build only: ack boxes unchecked, or peer not verified | Send, Open and Accept stay disabled; nothing is proven or sent; the policy refuses if forced |

Record memory and proving time for each step on Safari iOS (R-16).
