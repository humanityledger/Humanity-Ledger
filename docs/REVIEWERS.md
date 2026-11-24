# Ledger Chat in five minutes, for reviewers

## Without installing anything (2 minutes)

Open the latest run of **R8 two browsers (testnet)** in the repository's Actions tab. Its summary lists every check, and the `r8-two-browser` artifact has `r8-receipt.json` with the transaction hash of the private payment. Each run starts from nothing: two new Ethereum accounts, two browsers, real XMTP, a real Aztec node, proofs made in the page. Paste the hash into the test-network explorer to see that the transaction exists and that its amount and recipient are not visible.

How the run is built: `docs/alpha/R8_SESSION.md`.

## On ledgerchat.org (3 minutes for the chat; payments need Fee Juice)

1. Open `https://ledgerchat.org/connect` and sign in with any Ethereum wallet (one signature, Sign-In with Ethereum). No phone number, no email.
2. Write to another wallet address or `@username`. Direct messages are end-to-end encrypted with MLS through XMTP; no fee and no Aztec account are needed to chat.
3. Open **Verify encryption** in the conversation and compare the code with the other person.
4. Payments: open the private wallet from the attach menu. On Aztec Alpha each account pays its own network fee in Fee Juice; Ledger Chat sponsors none. Bridge a little AZTEC from your Ethereum wallet, or ask a contact for a **fee link** and they pay it for you. The first transaction deploys your Aztec account.
5. Share your Aztec address in the DM (it is sent with a proof of control, G7). When the other side's card says verified, the payment you send from the conversation is a private transfer proved on your device. The DM gets the transaction hash; the amount and recipient stay private, and the account that pays the fee is public.

## What to read next

- `docs/STATUS.md`: what is real, what is in tests only, what is not claimed.
- `docs/audit/START_HERE.md`: the reviewer's start page for the code.
- `docs/ACCOUNT_MODEL.md`: keys, passkeys and G7.
