# The Ledger Chat dashboard

`ledgerchat.org/dashboard`, 25 November 2026. Code: `components/dashboard/`, `lib/dashboard/`, `app/dashboard/page.tsx`.

The dashboard shows everything Ledger Chat can show about your account. It computes all of it in your browser, from the private wallet you open there and from your own records. The server renders the empty frame and receives nothing private.

`/dashboard?example=1` shows a made-up account with 1,400 events, so the page can be seen with a history. The data is labelled "Example data" on every screen and is never mixed with a real wallet.

## 1. What the dashboard shows, and where each piece comes from

| Information | Source | Where it lives | Marker |
|---|---|---|---|
| Private balance per token | Notes decrypted by the PXE in the browser (`WalletSnapshot.balances`) | Encrypted wallet storage (OPFS) | Device proof |
| Payments sent and received | Private `Transfer` events the PXE decrypts, plus payments this device proved (`lib/aztec/wallet/history.ts`) | Encrypted wallet storage and `hl_aztec_activity_v1_<address>` | Device proof |
| Shield, unshield, test tokens | Recorded when this device sends them | `hl_aztec_activity_v1_<address>` | Local |
| Totals per token, counts by kind and status, 90-day chart, first and last event, active days | Computed from the two rows above (`lib/dashboard/model.ts`) | Memory only | Local |
| Counterparties, with the number and totals of payments | Same, grouped by Aztec address | Memory only | Local |
| "Address proven in a chat" | Verified peer bindings (`hl.aztec_peer.verified:<inbox>`, `lib/aztec/peer-binding.ts`) | localStorage | Local |
| Contact names | `ledger_contacts_<address>` (`lib/wallet/localAddressBook.ts`) | localStorage | Local |
| Receive-only setting | `hl.payments.limits.v1` (`lib/payments/personal-limits.ts`) | localStorage | Local |
| Alerts: no Fee Juice, deposits ready to claim, stuck or failed transactions, receive-only, audit status | `computeAlerts` | Memory only | Local and Public |
| Wallet state and current step | `WalletSnapshot.phase` and `step` | Memory | Local |
| Aztec address | The account the PXE derives | Encrypted wallet storage | Local |
| Fee Juice balance, deposits, plan, private fee balance | Aztec node and Ethereum (`WalletSnapshot.feeJuice`) | Public chain state | Public |
| Latest block, proven block, node version, settlement chain, rollup version | `PrivateWallet.networkStatus()` (node reads) | Public chain state | Public |
| Transaction hash and block of each event | The wallet record | Public chain state | Public |
| Messaging: inbox, this installation, devices on the inbox, direct chats, groups, accepted, requests, blocked | The XMTP database on the device, only when you press **Read** (`lib/dashboard/messaging.ts`) | Encrypted messaging database (OPFS) | Local |

Export: **Export CSV** writes the settled activity to a file on your device (`activityCsv`). Nothing is uploaded.

## 2. What is not on the dashboard, and why

| Not shown | Why |
|---|---|
| Agreements (escrows and streams) | Their invitations hold secrets and live inside the conversation; they are shown and acted on in the chat (`lib/aztec/chat-agreements.ts`). |
| Message text and names of chat contacts | The dashboard reads counts only, so nothing personal is copied out of the chat. |
| Shields and unshields sent from another device before this one synced | Received payments are rebuilt from notes; these operations emit no private event. |
| Proving times | The wallet does not record them yet. |
| Portal deposits and withdrawals | The portal is deployed nowhere (`docs/PORTAL.md`). The wallet's own withdrawal list appears in the wallet once it is. |

## 3. Coverage checklist

The checklist is the operator's list of 25 November 2026. Each line is either implemented or a stated limit.

**1. Interface states**

| Item | State |
|---|---|
| Empty (no activity) | Implemented: an empty state per view, with an action |
| PXE loading | Implemented: the four steps of the wallet with the current one marked |
| Sync in progress | Implemented: "Doing now" in Network, and in-flight counts |
| Connection or proving error | Implemented: error state with retry and "Copy details", plus failed events with their reason |
| No Fee Juice | Implemented: an "action" alert, and the KPI says so |
| Thousands of events | Implemented: virtualized list (`@tanstack/react-virtual`); the model runs in a worker. Measured at 10,000 events: 35 ms (Node 22, laptop); the test bound is 1.5 s |
| Light and dark | Implemented: dark is a selector on this page; light is the default |

**2. Mobile and PWA**

| Item | State |
|---|---|
| Safari iOS, Chrome Android | Implemented responsively: tabs scroll, rows drop secondary columns, 16 px inputs (no zoom). **Limit:** not yet tried on physical devices |
| Gestures and scroll | Native scroll. The list scroll is contained (`overscroll-behavior`) |
| Installed PWA | The manifest has a Dashboard shortcut. The service worker is network-first for pages |
| Memory and suspension | Node reads stop while the tab is hidden. The model is recomputed only when inputs change |

**3. Privacy and security**

| Item | State |
|---|---|
| Automated proof that nothing leaves | `test/unit/dashboard/privacy.test.ts`. The dashboard code has no network call: no `fetch`, XHR, beacon, WebSocket, EventSource, `/api/` or logger. The worker imports only the model. Computing with `fetch` stubbed calls nothing |
| Permanent local/public markers | A legend at the top, and a marker on every card, KPI and event |
| Disconnect and wipe | **Close the private wallet** and **Remove wallet data from this device** (confirmation; closes the wallet first, then deletes its stores and its activity record) |
| Several tabs or devices | The wallet runs in one tab at a time and hands itself over. The dashboard warns when another dashboard tab is open. Other devices keep their own records |

**4. Performance**

| Item | State |
|---|---|
| Virtualized lists | Yes (activity). People shows the 500 most active rows |
| Heavy work in a Web Worker | `lib/dashboard/model.worker.ts`, with a main-thread fallback |
| Mid-range devices | **Limit:** not measured on one; 10,000 events compute in 35 ms on a laptop |
| Documented limits | The local activity record keeps 200 operations the device sent; received payments come from notes without that cap |

**5. Accessibility**

| Item | State |
|---|---|
| Keyboard | Tabs follow the ARIA tabs pattern (arrows, Home, End). Every control is a button, link or form field. There is a skip link |
| Contrast | The site's ink scale (17.9:1 to 6.4:1 on white). Dark uses an inverted scale |
| Labels | Every state has a title and a sentence. Selects have labels. Live regions announce counts and loading |
| Hover, focus, active | Every button, tab, segment and row has all three |

**6. Landing**

| Item | State |
|---|---|
| Link from ledgerchat.org | **Dashboard** in the header navigation and the mobile menu (`lib/landing/chapters.ts` NAV) |
| Entry | Signed out: Sign in, which returns to the dashboard. Signed in: the dashboard opens only with the wallet that owns the Ledger Chat account. Another wallet gets **Switch wallet**, because the private keys derive from that wallet's signature. `/dashboard` was on the retired-pages list, which sent it to `/chat`; it was removed from that list on 25 Nov 2026 |
| Transition | Same header, footer, fonts and tokens as the landing. Signed out, it offers Sign in (returns to the dashboard) and See an example |

**7. Documentation**

This file, a delta in `docs/STATUS.md`, and comments in `lib/dashboard/*` where privacy is not obvious.

**8. Edge cases**

| Item | State |
|---|---|
| Many notes | The model and list scale as above |
| Just-created account | Empty states, plus the wallet's account-creation step |
| Browser data cleared | The wallet re-derives keys from the signature and resyncs notes. Shields and unshields from before are not recovered |
| PXE or network failing mid-use | Node reads fail quietly and retry every 30 s. Refresh errors leave the last good data. A wallet error shows the error state |

## 4. Languages

Every text is in English, Spanish, Russian, German and Chinese. `test/unit/i18n/dashboard-coverage.test.ts` fails when one is missing.
