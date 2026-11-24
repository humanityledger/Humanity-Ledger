# R8: two people, two browsers, one private payment

R8 is the private payment between two accounts that are not the operator. It has two parts, and only the second closes R8 on Aztec Alpha.

## 1. Automated, on the Aztec test network (every Monday, and on demand)

Workflow **R8 two browsers (testnet)**, `.github/workflows/r8-two-browser.yml`, runs `scripts/ui/r8-two-browser.mjs` against a test build (`components/chat/e2e/R8Harness.tsx`):

- two throwaway Ethereum accounts made for the run, neither the operator;
- two Chromium contexts, each with its own XMTP installation (dev network) and its own private wallet: PXE in the page, account deployed on the test network with Aztec's sponsored fee contract;
- G7 scheme v2 over a real DM, both ways, with the code the chat runs (`aztecAddressProof`, `recordPeerAnnouncement`, `verifiedPeerBinding`);
- refusals checked by reason: a payment to an unverified pin, and the genuine proof replayed to another inbox, forwarded by another sender, checked for another network, with the address swapped and with the signature flipped;
- one private payment of 0.01 test tokens through `sendDirectPrivatePayment`, proved in the sender's page; the receiver's wallet finds it after a sync, the DM carries the hash, and both balances move by exactly 0.01.

The run uploads `r8-receipt.json` (addresses, inbox ids, hashes, every check) and a screenshot of each page. It runs on the test network only, so it is evidence for the flow, not for Alpha. Sign-in (SIWE) is not part of it; `test/auth/siwe-routes.test.ts` covers it.

## 2. Human, on Aztec Alpha (still to be run)

Two people who are not the operator run the procedure in `docs/AZTEC_FOUNDATION_DOSSIER.md`, Annex B, each on their own device, with Stefan's authorization. Record each hash there only after the run. Payments between operator accounts do not count.

Before the session, check that a green automated run exists for the same commit. If it is red, fix that first: the Alpha session should not be where a flow bug is found.
