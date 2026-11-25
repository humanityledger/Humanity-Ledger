# Data inventory: who sees what (25 November 2026)

Written from the code on `main` at `ee6ed46`, not from intentions. Each line names the file that
shows it. When the code changes, this file changes in the same pull request. It is the source for
the trust centre (alignment items 46, 50 and 55) and for `lib/privacy/disclosure.ts`.

Legend: **Server** = our Next.js app, its Postgres, Redis and R2 storage on Railway.
**XMTP** = the XMTP network nodes. **Aztec** = anyone reading Aztec Alpha or the test network.

## Messages and calls

| Data | Who can read it | Evidence |
|---|---|---|
| Direct and group message text | The people in the conversation only (MLS through XMTP). XMTP nodes store ciphertext. | `lib/xmtp/client.ts` |
| Attachments and voice notes | Encrypted on the sender's device; the server stores ciphertext in R2 and never sees the key. | `app/api/chat/attachments/route.ts`, `lib/chat/remote-attachment.ts` |
| Community posts | Communities created from 24 November 2026: the members only, in an XMTP MLS group made by the creator's client; the server stores the group id and the post route answers 410. **Communities created before: the server can read them** (posts in Postgres in plain text; not migrated). | `app/api/chat/communities/route.ts` (`mlsGroupId`, `COMMUNITY_MLS_NEW`), `components/communities/CommunityReader.tsx` |
| Presence and typing | The server (Redis, 30 s and 5 s TTL) and the contacts it is shared with. | `app/api/chat/telemetry/route.ts`, `app/api/chat/presence/route.ts` |
| Contact list | **The server stores it** (who has whom as a contact), to answer presence checks. | `app/api/chat/contacts/route.ts` |
| Username ↔ wallet address | The server (table `ChatUsername`). Lookup is exact-match only, 30 per minute. | `app/api/chat/username/lookup/route.ts` |
| Push notifications | The push service sees that a notification was sent; with "hide content" on, it carries no text. | `lib/wallet/NotificationEngine.ts`, `lib/push/usePushNotifications.ts` |

## Verification and stickers (24 November 2026)

| Data | Who can read it | Evidence |
|---|---|---|
| Contacts you marked as verified, and the safety number at that moment | This device only (local storage). Nothing is sent. | `lib/chat/verified-contacts.ts` |
| Stickers sent | The people in the conversation (XMTP). The image files are served from our site, so our server sees that your browser loaded a pack, not to whom it was sent. | `lib/chat/stickers.ts`, `public/stickers/` |
| Closed beta request (the three-step form) | The operator, by email. | `components/beta/BetaRequestForm.tsx` |

## Account and sign-in

| Data | Who can read it | Evidence |
|---|---|---|
| Ethereum wallet address | The server (SIWE session). | `components/landing/ConnectPage.tsx` |
| Aztec keys | This device only, in stores encrypted with a key derived from the wallet signature. | `lib/aztec/wallet/client.ts` |
| Passkey record | This device and an encrypted backup on the server; the server cannot open it without the passkey. | `lib/aztec/wallet/passkey.ts` |
| Closed beta membership, invite codes | The server (codes stored as HMAC with a pepper). | `lib/beta/*`, `app/api/alpha/redeem/route.ts` |

## Payments (Aztec)

| Data | Who can see it | Evidence |
|---|---|---|
| Amount and recipient of a private transfer | Nobody outside the conversation. | `lib/privacy/disclosure.ts` |
| That an account sent a transaction, and its fee | **Anyone, on Alpha.** The account pays its own Fee Juice and is the public fee payer, so its transactions can be linked. On the test network, the sponsored fee contract pays. | `lib/aztec/fees.ts`, `lib/landing/content.ts` (`FEE_PRIVACY`) |
| Shield and unshield | Anyone: the amount and the account. | `components/zk/wallet/WalletSheets.tsx` |
| The payment message in the chat (transaction hash, request) | The people in the conversation (XMTP). | `lib/payments/payment-message.ts` |

## Known gaps, stated plainly

1. Posts in communities created before 24 November 2026 are readable by the server (alignment item 73). New communities are MLS groups.
2. The contact graph is stored on the server (alignment items 13 and 51).
3. On Alpha the fee payer is public (alignment items 60 and R4; `docs/aztec/FPC_EVALUATION.md`).
4. Closed (alignment item 42): the safety glyphs are a SHA-256 digest of both XMTP inboxes and every
   installation on them (`lib/chat/safety-glyphs.ts`), so a device added to either inbox changes them.
