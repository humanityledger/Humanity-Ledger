# Trust and limits, on one page

State on 26 November 2026. Each line points to the file that makes it true. If this page and the code disagree, the code is right and this page is a bug: please open an issue.

## Where the project stands

| | |
|---|---|
| Messaging | Live. While the beta runs, the chat opens only for invited members. Direct messages are end-to-end encrypted by XMTP (MLS, RFC 9420). We use XMTP's browser SDK 5.2.0; we do not implement MLS ourselves. |
| Private payments | A closed technical beta on Aztec Alpha, in cUSDC, for at most 100 invited members, from 23 Nov 2026 to 23 Feb 2027 ([`beta/CUSDC_BETA.md`](beta/CUSDC_BETA.md)). It is not a public launch. |
| External audit | Began 25 Nov 2026. No report yet. When it exists it will be published in full from [`/docs/audits`](https://ledgerchat.org/docs/audits), and `audit` in [`deployments/aztec-mainnet.json`](../deployments/aztec-mainnet.json) will point to it. Until then nothing here is externally audited. |
| Network | Aztec 6.0.0 "Tierra" (Alpha V6), which settles on Ethereum mainnet and carries real value. Aztec describes Alpha as early, with critical bugs expected. |
| Who runs it | Stefan Antonio Cirisanu, Humanity Ledger. Not affiliated with, endorsed by or audited by Aztec Labs, the Aztec Foundation, XMTP Labs or human.tech. |

## What protects a payment in the beta

Every one of these is checked before each cUSDC payment, on the server and again in the wallet ([`../lib/beta/cusdc-beta.ts`](../lib/beta/cusdc-beta.ts), [`../lib/beta/cusdc-beta-client.ts`](../lib/beta/cusdc-beta-client.ts)):

1. The beta is on and has not ended.
2. The cUSDC contract on the network runs the class the wallet expects ([`../lib/aztec/token-check.ts`](../lib/aztec/token-check.ts)).
3. A cap per payment exists, and no payment on Alpha exceeds 100 cUSDC whatever the cap ([`../lib/protocol/fees.ts`](../lib/protocol/fees.ts), `ALPHA_MAX_AMOUNT`).
4. Payer and payee are both active members.
5. Exits-only mode is off. Switching it on stops new payments at once, without a deploy; members can still move their own funds out.
6. The payee is the Aztec address verified in the conversation (G7). It is never typed and never taken from a request.

If the server does not answer, or answers anything but "send", the payment does not go ahead (fail-closed).

## What is private and what is not

| Private | Visible |
|---|---|
| Message content | That two XMTP inboxes exchange messages, and when |
| Payment amount, sender, recipient | That an Aztec transaction happened, its note hashes and nullifiers, and its fee |
| Private keys, viewing keys, the message database key: they stay on your device | The account that pays the fee. On Alpha each account pays its own, so one account's transactions can be linked to each other |
| Files you attach (encrypted in the browser; the key travels inside the XMTP message) | Your IP address to the other side of a call, unless "Hide my IP address" is on |
| The amount, toward our server: the beta checks send no amount | During the beta, our server is asked whether you may send and whether a contact's wallet address is a member; it learns that you checked that contact |

Ledger Chat holds no user funds, issues no token with value and sponsors no network fees. HLC, which appears in early records, is a test token with no monetary value and is no longer listed by the wallet on Alpha.

## Known limits, stated plainly

* Every payment recorded on Alpha went between accounts run by the operator. A payment between two different people has not been recorded yet.
* A cUSDC payment you receive shows in your balance, but not yet as an activity entry, because the token emits no private event ([`AZTEC_ALIGNMENT_AUDIT.md`](AZTEC_ALIGNMENT_AUDIT.md), A-06).
* Escrow and payment streams exist only on testnet. They are refused on Alpha until an audit exists.
* The Ethereum portal is written and tested in CI and deployed nowhere.
* Communities created before 24 Nov 2026 keep their posts readable by our server; newer ones are MLS groups.
* Nothing is quantum resistant, and nothing is formally verified.

## Check it yourself

```bash
node scripts/check-forbidden-copy.mjs   # fails if docs or UI claim what the code does not support
npm run test:run                        # unit and integration tests
```

Transactions on Alpha can be read on Aztecscan from the hashes in [`EVALUATION_DOSSIER.md`](EVALUATION_DOSSIER.md) §3.

## Report a problem

Security issues: a private advisory on GitHub or `humanityledger@icloud.com` ([`../SECURITY.md`](../SECURITY.md)). Everything else: [issues](https://github.com/humanityledger/humanity-ledger/issues).
