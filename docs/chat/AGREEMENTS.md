# Private agreements in Ledger Chat

**Status (5 November 2026):** in the chat on the Aztec test network, test tokens only, contracts not externally audited. The library underneath has run end to end on testnet (workflow "Aztec escrow e2e (testnet)", run 42030688268); the chat interface on top of it has not yet been through a recorded two-account session in browsers.

## What the person sees

1. **Attach menu → Private agreement** in a direct conversation (`components/chat/AgreementComposer.tsx`).
2. **Share my Aztec address** posts `{"type":"hl.aztec_address",…}` in the DM. The other side's card saves it the first time (trust on first use) and shows a conflict, without saving, if a different address arrives later.
3. With the peer's address saved, **Open escrow** or **Open stream**: token, amount, and a claim window (escrow) or duration (stream). The browser deploys a keyed contract instance for this agreement and funds it from the private balance; the invitation is posted in the DM.
4. The invitation renders as a card (`components/chat/AgreementCard.tsx`) with only its public fields. The recipient presses **Verify and accept**.
5. The card then reads the agreement from the contract and offers what applies: **Claim** (escrow, before the deadline), **Refund** (escrow, sender, after the deadline), **Withdraw** (stream, recipient, what has accrued), **Cancel stream** (sender).

## What is checked, where

| Step | Check | Code |
| --- | --- | --- |
| Pinning the peer's address | The announcement must come from the DM's peer inbox, resolved from the conversation's members; a different address is a conflict | `lib/aztec/peer-binding.ts`, `AgreementCard` |
| Accepting | The invitation comes from the pinned address, is addressed to me, names an accepted token, a current class from `deployments/aztec-testnet.json`, and an address and class that follow from its secret | `verifyAgreementInvite` in `lib/aztec/agreement-invite.ts` |
| Accepting | Network policy (on Alpha: recorded class, unaudited acknowledgement, per-token cap) | `lib/aztec/agreement-policy.ts` |
| After registering | Every field of the invitation equals the contract's stored note (`escrow_view`, `stream_view`) | `confirmAgreement` in `lib/aztec/agreements.ts` |
| Every action | The instance recomputed from the secret is the one in the invitation | `ensureRegistered` in `lib/aztec/chat-agreements.ts` |

## Secrets

An invitation carries the contract's secret key and, for an escrow, the claim secret. It travels only as an XMTP message in the DM (end to end encrypted). The chat:

- never shows it as text: the conversation list, notifications, reply snippets, forwarding and Copy use `agreementPreview`;
- sends it exactly as built: no reply or thread wrapper, no text transforms, no disappearing timer;
- refuses to send it offline, so it is never written to the plain-text offline outbox;
- never logs it.

It remains in the device's local message history, like any other message.

## Known limits

- The saved address proves where it came from, not that the peer controls that Aztec account (a signature by the account over the XMTP inbox would).
- After a claim, the recipient's escrow copy is consumed, so the recipient's card says "claimed, or not yet visible"; the sender's card says settled.
- A stream starts two minutes in the past so the first block accepts it; the recipient can withdraw those two minutes of accrual at once.
- Proving runs in the browser and can take minutes for the first agreement on a device.
