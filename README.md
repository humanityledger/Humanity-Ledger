<div align="center">

# Ledger Chat

**Encrypted messages and private payments in one conversation.**

Messages travel over XMTP (MLS, RFC 9420). Payments are proved on your device and settled privately on Aztec.

[Request beta access](https://ledgerchat.org/beta) · [Run it locally](#quick-start) · [How it works](#how-it-works) · [Security and limits](#security-and-limits) · [⭐ Star this repo](https://github.com/humanityledger/humanity-ledger/stargazers)

<img src="assets/launch/payment-progress.gif" width="320" alt="The payment card in the Ledger Chat private wallet moving through its real stages: checking the fee, making the proof on this device, sent to Aztec, settled. The card states what is visible on chain: that a transaction happened and its fee, not the amount, the sender or the recipient.">

<sub>The payment card in the private wallet, captured on Aztec Alpha on 14 November 2026. The amount line is cropped.</sub>

<!-- DEMO VIDEO (15 to 20 s, chat to private payment). Record and upload as described in assets/launch/README.md, then paste the github.com/user-attachments URL on the line below, alone on its line. -->

</div>

> [!IMPORTANT]
> **Status on 26 November 2026.** Private payments run only in a **closed technical beta** on Aztec Alpha: at most 100 invited members, in cUSDC, with a cap per payment and never more than 100 cUSDC, until 23 February 2027. An **external audit began on 25 November 2026; there is no report yet**, so nothing here is externally audited. Aztec Alpha carries real value and is early software. Humanity Ledger is not affiliated with, endorsed by or audited by Aztec Labs, the Aztec Foundation, XMTP Labs or human.tech.

## Why it matters

* **Pay where you agreed.** Request and send money inside the conversation, without copying an address into another app.
* **The amount and the people stay private.** On Aztec, a transfer shows that it happened and its fee. It does not show who paid, who was paid or how much.
* **Proofs are made on your device.** The browser runs Aztec's Private Execution Environment. Your keys and the amount never leave it.
* **You pay the person you are talking to.** The payee is the Aztec address cryptographically bound to the chat contact (G7). It is never typed, pasted or taken from a request.

## What it is

Ledger Chat is a web messenger. Direct messages are end-to-end encrypted by XMTP, which implements MLS; our server never sees their content. Next to the message box there is a private wallet: an Aztec account derived from a signature of your Ethereum wallet, whose proofs are built in the browser. Voice and video calls, encrypted attachments, communities and five interface languages complete it. The code is open, MIT OR Apache-2.0.

## How it works

<img src="assets/launch/architecture.png" width="900" alt="Architecture. Your browser holds the wallet, an encrypted message store, the G7 peer check and the Aztec PXE. Messages go to the XMTP network as MLS ciphertext. Payments go to Aztec Network Alpha as a proof, encrypted notes and a public fee; Aztec settles on Ethereum. The Ledger Chat server handles sign-in, presence and encrypted files, with no keys and no direct message content.">

1. **Talk.** Messages are encrypted on your device with MLS and relayed by the XMTP network. XMTP sees which inboxes exchange traffic, not what they say.
2. **Verify.** Before the first payment, your client checks a G7 proof that the other person's Aztec address belongs to the same XMTP inbox, and pins it. ([spec](docs/aztec/G7_BINDING_SPEC.md))
3. **Pay.** The PXE in your browser builds a zero-knowledge proof of the transfer and sends only the proof, nullifiers and encrypted notes to Aztec. Your own account pays the network fee in Fee Juice; Ledger Chat sponsors no fees. The recipient's wallet discovers the note and decrypts the amount.

## Security and limits

| Stays private | Is public or visible | Limits today |
|---|---|---|
| Message content (MLS) | That two XMTP inboxes exchange traffic | Closed beta: invited members only |
| Payment amount, sender and recipient | That an Aztec transaction happened, and its fee | Cap per payment; at most 100 cUSDC on Alpha |
| Private keys, viewing keys, message database key | The account that pays the fee, so its transactions are linkable | Exits-only switch stops new payments at once, without a deploy |
| Attachment keys (files are encrypted in the browser) | Your IP to call peers, unless "Hide my IP address" is on | No external audit report yet |

Every recorded payment on Alpha went between accounts run by the operator; a run between two different people is still open. Read [`docs/TRUST.md`](docs/TRUST.md) for the one-page picture, [`SECURITY.md`](SECURITY.md) to report a vulnerability, and [`docs/EVALUATION_DOSSIER.md`](docs/EVALUATION_DOSSIER.md) for every claim with its evidence.

## Quick start

**Use it.** Request an invitation at **[ledgerchat.org/beta](https://ledgerchat.org/beta)**. While the beta runs, the chat opens only for members.

**Run it locally** (Node 22, Docker):

```bash
git clone https://github.com/humanityledger/humanity-ledger.git && cd humanity-ledger
npm ci
POSTGRES_PASSWORD=postgres docker compose up -d postgres redis
cat > .env.local <<EOF
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/humanity_ledger"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
EOF
npx prisma generate && npx prisma db push
npm run dev    # http://localhost:3000/chat
```

**Check the claims yourself:**

```bash
npm run test:run                          # unit and integration tests (Vitest)
node scripts/check-forbidden-copy.mjs     # no claim the code does not support
npm run test:contracts                    # Solidity, including the portal (Hardhat)
```

The aztec-nr contracts compile and run their TXE tests in CI with the official Aztec 6.0.0 toolchain ([`.github/workflows/aztec-contracts.yml`](.github/workflows/aztec-contracts.yml)). More in [`docs/QUICKSTART.md`](docs/QUICKSTART.md).

## Current status

| Component | State |
|---|---|
| Direct messages (XMTP v3, MLS) | Live |
| Private wallet: send, shield, unshield | Live on Aztec Alpha for beta members (cUSDC); first private cUSDC transfer in L2 block 46420, 23 Nov 2026 |
| Payment requests and cards in the chat | Live; a received cUSDC payment shows in the balance but not yet as activity |
| G7 binding of chat identity to Aztec address | In code and unit tests; not yet run between two different people |
| Voice and video calls, encrypted attachments | Live |
| Escrow and payment streams (aztec-nr) | Testnet only; refused on Alpha until an audit exists |
| Ethereum portal and receiver addresses | Written and tested in CI; deployed nowhere |
| External audit | Began 25 Nov 2026; no report yet |

Full table with evidence: [`docs/EVALUATION_DOSSIER.md` §1](docs/EVALUATION_DOSSIER.md#1-status-as-of-25-november-2026). Daily changes: [`docs/STATUS.md`](docs/STATUS.md).

## Built on Aztec

Aztec 6.0.0 "Tierra" (Alpha V6) · aztec-nr `v6.0.0` · `@aztec-labs/*` 6.0.0 · `EmbeddedWallet` with the PXE in the browser · gas limits from simulation · Fee Juice paid by each account · token classes checked against held artifacts before use. How each piece follows Aztec's own patterns, and where it does not yet: [`docs/AZTEC.md`](docs/AZTEC.md) and [`docs/AZTEC_ALIGNMENT_AUDIT.md`](docs/AZTEC_ALIGNMENT_AUDIT.md).

## Documentation

| For | Read |
|---|---|
| A reviewer or auditor | [`docs/audit/START_HERE.md`](docs/audit/START_HERE.md) |
| Every claim with its source | [`docs/EVALUATION_DOSSIER.md`](docs/EVALUATION_DOSSIER.md) |
| Trust, limits and what is public | [`docs/TRUST.md`](docs/TRUST.md) |
| The Aztec integration | [`docs/AZTEC.md`](docs/AZTEC.md) |
| Contributing | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## Licence

MIT OR Apache-2.0 ([`LICENSE`](LICENSE)). Names and marks: [`TRADEMARKS.md`](TRADEMARKS.md). Built by Humanity Ledger; ownership and copyright in [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). Contact: `humanityledger@icloud.com`.

<div align="center">

**If you want private payments inside messaging to exist, a ⭐ helps other engineers find this work.**

</div>
