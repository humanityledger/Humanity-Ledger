# Private network fees (PrivateFPC)

On Aztec Alpha every transaction names its fee payer publicly. Today that payer is the person's own Aztec account, which links their transactions. With `NEXT_PUBLIC_AZTEC_PRIVATE_FEES=on`, Ledger Chat can pay fees through the **PrivateFPC**, the fully private fee payment contract the Aztec documentation recommends ("Pay Fees Privately"). It is published as npm `@alejoamiras/private-fee-juice` (MIT, community-maintained, originally by Wonderland). It has no public functions, no owner and no operator, and it is never deployed: its address comes from its bytecode and the shared salt `1`, so every app that uses it pools fees into one privacy set. Ledger Chat runs no fee contract (decision Q8).

## What changes for the person

- **Add Fee Juice**, once the account exists, offers *Pay my network fees privately* (on by default when offered). The L1 deposit goes to the Fee Juice portal with the PrivateFPC as recipient, and with a secret bound to the person's Aztec account. The deposit is public on Ethereum, as every Fee Juice deposit is.
- The next payment claims that deposit and pays its fee in the same transaction. What is left stays as the person's private balance inside the PrivateFPC. Later payments pay from that balance.
- The public fee payer of those transactions is the shared contract, not the person's account.

## Safety in the code (`lib/aztec/private-fees.ts`, `lib/aztec/wallet/client.ts`)

- The address is only valid for one Aztec version. Nothing is registered, deposited or paid unless the node reports exactly the version in the package's `canonical-deployment.json` (6.0.0). Registration uses `assertCanonical`.
- The contract keeps the whole maximum fee (no refund). Gas settings come from the package's `estimateGasSettings` with a client-side ceiling (`PRIVATE_FEE_MAX_COST`, 5 Fee Juice). The balance, or one ready deposit on its own, must cover that maximum. Otherwise the payment is paid from the account's own Fee Juice as before.
- Bridge salts are derived from the wallet signature, never random, so the deposit material can be found again.
- Account creation still needs the account's own Fee Juice. Only payments after it use private fees.

## Before switching it on in production

1. Merge with CI green (typecheck, unit tests `test/unit/aztec/private-fees.test.ts`, build with the package).
2. On a preview build with the variable on, with one account that already exists: add the smallest deposit the form accepts with the private option, wait until it is ready, then send a 0.01 private payment. Check on AztecScan that the transaction's fee payer is the PrivateFPC address (`canonical-deployment.json`), not the account. Send a second payment and check that it pays from the private balance.
3. Record both hashes in `deployments/aztec-mainnet.json`, then set the variable in production.
