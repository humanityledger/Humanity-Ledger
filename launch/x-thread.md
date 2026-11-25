# X thread (11 posts)

Post 1 alone, then reply to it with 2 to 11 within two minutes. Each post is under 280 characters (links count as 23). Images are in `assets/launch/`. Every claim here is in `docs/TRUST.md` or `docs/AZTEC.md`.

---

**1/** · image: `social-preview.png`

```
When you pay someone from a chat, who else learns the amount?

In Ledger Chat, nobody but the two of you. The payment is proved on your device and settled privately on Aztec. On chain: that it happened, and its fee.

Open source. How it works 🧵
```

**2/**

```
Messages are end-to-end encrypted over XMTP (MLS, RFC 9420). We use XMTP's SDK; we don't roll our own MLS.

Payments use an Aztec account that lives in your browser, derived from a signature of your Ethereum wallet. No phone number, email or password.
```

**3/** · image: `architecture.png`

```
The architecture fits in one picture.

Keys, message plaintext, amount and recipient never leave your device. XMTP relays ciphertext. Aztec verifies a zero-knowledge proof. Ethereum settles the rollup.
```

**4/** · GIF: `payment-progress.gif`

```
What a payment looks like:

fee check → proof made on this device → sent to Aztec → settled in a block.

The card states what is visible on chain, every time: that a transaction happened and its fee. Not the amount, not the people.
```

**5/**

```
The hard part isn't the proof. It's paying the right person.

Before the first payment, your client checks a Schnorr signature that binds the contact's XMTP inbox to their Aztec address, and pins it. The payee is never typed, pasted or taken from a request.
```

**6/**

```
Fees, plainly: every account pays its own Fee Juice. We sponsor nothing.

Gas limits come from a simulation, so an account needs ~15–19 AZTEC of Fee Juice instead of ~42.

On Aztec Alpha the fee payer is public. The amount and the parties are not.
```

**7/**

```
Built on Aztec 6.0.0 "Tierra": aztec-nr v6.0.0, the PXE running in the browser through EmbeddedWallet, token classes checked against held artifacts before use.

The contracts compile and run their tests in CI with the official toolchain.
```

**8/**

```
What it is not, yet:

• a closed beta: ≤100 invited members, cUSDC, capped per payment
• external audit began 25 Nov, no report yet
• every payment recorded so far was between accounts we run
• not affiliated with Aztec Labs or XMTP Labs
```

**9/**

```
Why put that in a launch thread?

Because privacy software that overclaims is worse than none. The repo has a check that fails CI when the docs or the UI claim something the code does not support.
```

**10/**

```
If you build on Aztec or XMTP, it's all readable: the binding spec, the aztec-nr contracts, an alignment audit against the 6.0.0 migration notes, and every claim with its source file.

Reviews and issues are very welcome.
```

**11/**

```
Code: https://github.com/humanityledger/humanity-ledger
Beta requests: https://ledgerchat.org/beta

If you want private payments inside messaging to exist, a ⭐ on the repo is how other engineers find it.
```

---

**Reply to your own post 1, five minutes after posting** (keeps the link out of the first post, where it lowers reach):

```
Repo, for anyone who wants to read the code first: https://github.com/humanityledger/humanity-ledger
```
