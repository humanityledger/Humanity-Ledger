# Prepared answers to the eight most likely objections

Answer fast, agree with what is true, link the file that proves it. Never argue about other projects.

**1. "Unaudited code with real money? No thanks."**

```
Fair. That's why payments run only in a closed beta: invited members, a cap per payment, never more than 100 cUSDC, and a switch that stops new payments without a deploy. An external audit began 25 Nov; the report will be published in full. Details: https://github.com/humanityledger/humanity-ledger/blob/main/docs/TRUST.md
```

**2. "Is there a token? What's the catch?"**

```
No token with value, and we don't hold user funds. Payments in the beta are in cUSDC, a dollar token issued by human.tech, which we don't issue, hold or redeem. HLC in our early records is a test token with no value. We charge no protocol fee.
```

**3. "Aztec Alpha itself says critical bugs are expected."**

```
Yes, and we say so on the first screen of the README. Caps per payment, a closed member list and an exits-only switch are there because Alpha is early.
```

**4. "If the fee payer is public, it isn't private."**

```
Partly right: on Alpha the account that pays a fee is visible, so one account's transactions can be linked. The amount, sender and recipient are not visible. A route through a shared PrivateFPC is written and off by default until it is reviewed: docs/PRIVATE_FEES.md
```

**5. "XMTP still leaks who talks to whom."**

```
Correct. MLS protects content, not traffic metadata, and we don't claim otherwise. Calls can be forced through TURN to hide your IP ("Hide my IP address").
```

**6. "Keys in a browser are a bad idea."**

```
The Aztec keys are derived from a signature of your own Ethereum wallet and kept in encrypted stores on your device; no server receives them (test/key_custody.test.ts). A compromised device is a compromised wallet, as with any hot wallet. The caps exist for that reason too.
```

**7. "Is Aztec Labs behind this?"**

```
No. Built on Aztec, not affiliated with, endorsed by or audited by Aztec Labs or the Aztec Foundation. We published our own alignment audit against Aztec 6.0.0, including where we don't follow their patterns yet: docs/AZTEC_ALIGNMENT_AUDIT.md
```

**8. "Why would I star a repo I can't use yet?"**

```
You don't have to. If you'd like private payments in messaging to exist, a star helps other engineers find the code and review it, which is what an early privacy project needs most. You can also request a beta invite: ledgerchat.org/beta
```
