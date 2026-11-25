# X: alternative first posts and standalone posts

## Three alternatives to post 1 of the thread

**A. Question hook** (default in `x-thread.md`)

```
When you pay someone from a chat, who else learns the amount?

In Ledger Chat, nobody but the two of you. The payment is proved on your device and settled privately on Aztec. On chain: that it happened, and its fee.

Open source. How it works 🧵
```

**B. Builder hook**

```
I spent a year building one thing: a messenger where a payment is as private as the message next to it.

Ledger Chat: XMTP (MLS) for messages, Aztec for payments, zero-knowledge proofs made in your browser. Now in closed beta on Aztec Alpha.

How it works 🧵
```

**C. Technical hook**

```
A private payment inside an encrypted chat needs three things:

1. a proof made on the device
2. a network that hides amount and parties
3. proof that the address belongs to the person you're talking to

Ledger Chat does all three on Aztec. Open source 🧵
```

## Five standalone posts (day 2, one every few hours)

**1. G7, for engineers** · image: none

```
How do you make sure a payment sent from a chat reaches the person in the chat, and not someone who swapped the address in between?

We bind the XMTP inbox to the Aztec address with a Schnorr signature over Grumpkin, check it, and pin it. Spec: https://github.com/humanityledger/humanity-ledger/blob/main/docs/aztec/G7_BINDING_SPEC.md
```

**2. What's on chain** · image: `payment-progress-strip.jpg`

```
What a private payment on Aztec reveals: that a transaction happened, its note hashes and nullifiers, and its fee.

What it doesn't: who paid, who was paid, how much.

Ledger Chat shows you this on every payment card, before you send.
```

**3. Honesty as a feature** · image: none

```
Our repo has a script that fails CI if the README, the docs or the UI claim something the code doesn't support.

It blocks wording like "audited" or "production circuits", which our own early drafts used and we withdrew.

https://github.com/humanityledger/humanity-ledger
```

**4. Fees** · image: none

```
We don't sponsor network fees. Every account pays its own Fee Juice on Aztec.

We do make them smaller: gas limits from a simulation, padded 25%, so an account needs ~15–19 AZTEC of Fee Juice instead of ~42. Code: lib/aztec/fee-juice.ts
```

**5. Status** · image: `architecture.png`

```
Ledger Chat, where it stands:

✓ encrypted messages (XMTP, MLS)
✓ private payments in a closed cUSDC beta on Aztec Alpha
✓ proofs made in the browser
… external audit began 25 Nov, report pending
… escrow and streams on testnet only

https://github.com/humanityledger/humanity-ledger
```
