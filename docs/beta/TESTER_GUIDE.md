# cUSDC beta: guide for testers

You were invited to a closed technical test of private cUSDC payments in Ledger Chat, with at most 100 people. This guide shows what to do and what to tell us. It is not legal terms. The beta notice you confirm when you join says what the test is and what it is not.

## Before you start

- **A wallet.** You sign in to Ledger Chat with your own Ethereum wallet. Ledger Chat never holds your keys or your funds.
- **Fee Juice.** Every private transaction on Aztec Alpha pays a network fee in Fee Juice (AZTEC bridged from Ethereum). Ledger Chat pays no fees for you. Bridge some under Settings, Network fees, or ask the beta organiser for a fee link.
- **cUSDC.** cUSDC is issued by human.tech through Shield, not by Ledger Chat. You bring it into your private balance through Shield.
- **Small amounts.** Payments are real and cannot be reversed. Each payment is limited.

## Join

1. Open `ledgerchat.org/beta`. If you are not signed in, sign in with your wallet first; you come back to the page.
2. Check that the wallet shown is yours, then continue.
3. Enter your invitation code (16 characters, `XXXX-XXXX-XXXX-XXXX`). You can paste it into any box.
4. Read the beta notice, tick the box and press "Unlock cUSDC Beta".
5. The page opens the chat. Open your private wallet: cUSDC appears at its next refresh.

If the page says the invitation is not active yet, ask the person who invited you. Trying again with the same code is safe.

## What to try

| # | Mission | What you should see |
| --- | --- | --- |
| 1 | Share your Aztec address with another tester in a direct chat | Both cards say "verified" |
| 2 | Send them a small private payment in cUSDC from the chat | Your card goes from "Sending privately" to "Payment sent", then "Payment confirmed" |
| 3 | Receive one | A notice "You received … privately." once, and the card turns to "Payment received" |
| 4 | Ask them for a payment (attach menu, Request a payment) | A request card with the amount, note and expiry |
| 5 | Pay a request you received | The pay form opens with the token and amount fixed; afterwards both request cards say "Paid" |
| 6 | Try to request more than the limit per payment | The request cannot be sent, and the form says why |
| 7 | Close and reopen the app | Old payments do not raise new notices; balances and cards are unchanged |

## What to report

Send the organiser, for each problem:

- what you did, and what you expected;
- what you saw (a screenshot is enough, with no seed phrase, PIN or private key in it);
- your device, browser and the time;
- the transaction link from the card, if there is one.

Never send anyone your seed phrase, PIN or private key. Nobody from Ledger Chat will ask for them.

## If something goes wrong

- **A payment says "failed".** Nothing moved. You can try again.
- **A payment stays "sent" for long.** The network has not included it yet. Do not send it again; wait, then use "Check now" on the card.
- **cUSDC disappeared from your wallet.** Tell the organiser. If the beta was paused or your access was revoked, your balance stays visible and you can still move your own funds.
- **New payments are refused for everyone.** The organiser may have paused new payments while checking something. Moving your own funds keeps working.
