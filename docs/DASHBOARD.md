# The Ledger Chat dashboard

`ledgerchat.org/dashboard`, 25 November 2026, second version. Code: `components/dashboard/`, `lib/dashboard/`, `app/dashboard/page.tsx`.

The dashboard shows what Ledger Chat can show about one account: private balances, payments, counterparties, the private node and the network, Fee Juice, and, on request, counts from the messaging database. It computes all of it in the browser, from the private wallet opened there and from the records that browser keeps. The server renders the empty frame and receives nothing private.

`/dashboard?example=1` shows a made-up account with 1,400 records, so the page can be seen with a history. It says "Example data" above every section and is never mixed with a real wallet (section 4).

## 1. The way in

`components/dashboard/Gate.tsx`. One screen per situation, each with one title, one sentence and one main action.

| Situation | Screen | Action |
|---|---|---|
| Session still being checked, or wagmi still reconnecting the wallet | Nothing for 400 ms, then "Checking your session" (text, no spinner) | — |
| No session | "Sign in to open your dashboard" | **Sign in** → `/connect?redirect=/dashboard`. After sign-in the connect page returns here (`safeReturnPath`). A quiet link opens the example |
| Session, no wallet connected | "Connect the wallet of your account", with the Ledger Chat account in full (copyable) and "Connected wallet: None" | **Connect wallet** (AppKit) |
| Session, another wallet connected | "This wallet is not linked to your account", with both addresses in full | **Switch wallet** (AppKit). When the wallet app switches account, the page moves on by itself |
| The account's wallet, private wallet not open | "Open your private wallet", one signature | **Open private wallet**. A declined signature leads to the error screen below, which says so |
| The private wallet is open in this tab for this account (for example, after the chat) | — | Straight to the dashboard, no screen in between |
| The private wallet in this tab is open for another account | The same open screen, saying so | Opening it for this account closes the other |
| Opening | "Opening your private wallet", four numbered steps, the current one in bold, the wallet's own step text | — |
| Opening failed | "The private wallet did not open", the reason | **Try again**, and **Copy details** for support |

Only the wallet of the signed-in Ledger Chat account gets through (`useAztecWallet().sameAccount`: the connected wallet, the in-memory wallet, or the linked phone of that same account). The private keys are derived from that wallet's signature, so any other wallet would show another account. A wallet opened earlier in the tab for a different account is never shown under this one (`PrivateWallet.openedFor`, `sources.walletIsFor`).

The signature is asked for with a button, never on page load. Wallet apps on phones open only from a user gesture, and a signature request that appears without one is a surprise. Opening with a passkey stays in the wallet panel of the chat: the dashboard admits only the account's wallet.

Leaving: **Close wallet** in the header closes the private wallet in this tab (back to the open screen). **Your data → Remove wallet data from this device** also deletes its stores, after a confirmation, and is refused while a transaction is being proven or sent.

## 2. What the dashboard shows, and where each piece comes from

Every section heading carries its source in grey: **this device** (kept only in this browser), **private node** (found or proven by the PXE in this browser), **public chain** (readable by anyone on Aztec or Ethereum).

| Information | Source | Where it lives | Marker |
|---|---|---|---|
| Private balance per token, and any public balance | Notes decrypted by the PXE in the browser (`WalletSnapshot.balances`) | Encrypted wallet storage (OPFS) | private node |
| Payments sent and received | Private `Transfer` events the PXE decrypts, plus payments this device proved (`lib/aztec/wallet/history.ts`) | Encrypted wallet storage and `hl_aztec_activity_v1_<address>` | private node |
| Shield, unshield, test tokens | Recorded when this device sends them | `hl_aztec_activity_v1_<address>` | this device |
| Totals per token, counts by kind and status, 90-day chart, first event, active days | Computed from the rows above (`lib/dashboard/model.ts`) | Memory only | this device |
| Counterparties, with the number and totals of payments | Same, grouped by Aztec address | Memory only | this device |
| "Address proven in a chat" | Verified peer bindings (`hl.aztec_peer.verified:<inbox>`, `lib/aztec/peer-binding.ts`) | localStorage | this device |
| Contact names | `ledger_contacts_<address>` (`lib/wallet/localAddressBook.ts`) | localStorage | this device |
| Receive-only setting | `hl.payments.limits.v1` (`lib/payments/personal-limits.ts`) | localStorage | this device |
| Alerts: no Fee Juice, deposits ready to claim, stuck or failed transactions | `computeAlerts`; shown only when there is one | Memory only | this device and public chain |
| Notes: receive-only, the audit status | `computeAlerts` (info level), as plain notes under the summary | Memory only | — |
| Wallet state, current step, Aztec address, when notes last synced | `WalletSnapshot`, `PrivateWallet.openedFor`, the live notes read | Memory | this device |
| Fee Juice balance, what one transaction needs, how the next one pays, deposits, private fee balance | Aztec node and Ethereum (`PrivateWallet.refreshFeeJuice()`) | Public chain state | public chain |
| Latest block, proven block, blocks not yet proven, node version, settlement chain, rollup version | `PrivateWallet.networkStatus()` | Public chain state | public chain |
| Transaction hash and block of each record | The wallet record | Public chain state | public chain |
| Messaging: inbox, this installation, devices on the inbox, direct chats, groups, accepted, requests, blocked | The XMTP database on the device, only when you press **Read my messaging database** (`lib/dashboard/messaging.ts`) | Encrypted messaging database (OPFS) | this device |
| Local metrics: how long the model took and where (worker or page) | `DashModel.computedInMs`, `useDashboardModel` | Memory | — |

Export: **Export CSV** writes the activity to a file on your device (`activityCsv`). Nothing is uploaded.

## 3. Live connection points

`lib/dashboard/live.ts` (`LiveSource`, pure, tested with a fake clock) and `lib/dashboard/useLive.ts` (binds it to the page). Each source is a call into the private wallet that already runs in this tab. The dashboard has no network call of its own (`test/unit/dashboard/privacy.test.ts` fails on `fetch`, XHR, beacon, WebSocket, EventSource, `/api/` or a logger in any dashboard file).

| Source | Call | Reaches | Every | Notes |
|---|---|---|---|---|
| node | `wallet.networkStatus()` | The Aztec node (public reads: node info, block, proven block) | 15 s | No block number in the answer counts as a failed read |
| notes | `wallet.refresh()` | The PXE in this browser, which syncs this account's notes from the node and decrypts them locally; balances and activity follow | 60 s | Skipped, not failed, while `wallet.transacting` (a proof or a send is running) |
| fee | `wallet.refreshFeeJuice()` | Public Fee Juice state on the node; L1-to-L2 message readiness | 60 s | Aztec Alpha only; first read 2 s after the others |

Behaviour of every source:

- reads at once when it starts, then at its interval;
- after a failure, retries at a quarter of its interval, doubling each time, at most every five minutes; the last good value stays on screen with its age ("read 4 min ago");
- stops while the tab is hidden and reads at once when it is visible again;
- stops while the browser is offline (`online`/`offline` events, `navigator.onLine`) and reads at once when it is back;
- never runs two reads at once; **Refresh** in the header and **Read now** in Network read immediately;
- an option passed as `undefined` keeps its default (a regression test: the first build passed `maxBackoffMs: undefined`, which made the retry delay NaN and the retries immediate; caught in the headless browser run, fixed, tested).

The live line under the header says, per source, in words and without colour or motion: "Node block 31,205, proven 31,181, read just now", "Private notes synced 12 s ago", "Node not answering, next try in 6 s, last read 2 min ago", "offline, last read at 14:02", "Private notes waiting for the transaction to finish".

The model (`lib/dashboard/model.ts`) is recomputed in a Web Worker when the activity changes, after every notes sync (bindings and contacts are read again), and falls back to the page when the worker cannot start or answers with an error.

## 4. Real data only

`lib/dashboard/sources.ts` is the one place that decides where data comes from.

- `dataMode(search)` is `example` only for exactly `?example=1`.
- Live: `accountFor` returns the session's own account or nothing; `walletView` returns the private wallet's own state object, unchanged; `modelInputs` reads only the activity, tokens, storage and contacts it is handed. Nothing is filled in when a source is empty.
- Example: the made-up account, balances, activity, people and names live in `lib/dashboard/example.ts` and are reachable only through `sources.ts`. The example shows the notice "Example data. … Nothing here is yours, and nothing is read from a network or from your device." above every section, has no live line, reads nothing, and disables the device actions.

`test/unit/dashboard/real-data.test.ts`: the exact `?example=1` rule; signed out means no account; the live wallet state is passed through unchanged; a wallet opened for another account is not shown; empty sources give an empty model; only what the sources hold reaches the model; no example value appears in the live input or model; only `sources.ts` imports the example module; no dashboard component holds an address, a bigint amount or an example name; the page labels the example above the tabs.

## 5. Visual rules

White page, black ink, greys only. Hierarchy from weight, size and space; hairline rules instead of boxes. Nothing moves: no animation, transition, transform, spinner, skeleton or smooth scrolling. No radius, shadow, gradient, blur or icon. One light theme (the first version's dark toggle is gone). The overview is a wide reading column (balances, 90 days, latest, totals) and a narrow column of facts, not a grid of equal cards. The 90-day chart is one ink: money in above the line, money out below. Waiting states say what is happening in words, and appear only after 400 ms so a fast answer never flashes one.

`test/unit/dashboard/visual-rules.test.ts` checks the CSS module and every component for all of the above, that every colour literal is grey, that controls are at least 32–44 px tall, and that phone inputs are 16 px.

## 6. What is not on the dashboard, and why

| Not shown | Why |
|---|---|
| Agreements (escrows and streams) | Their invitations hold secrets and live inside the conversation; they are shown and acted on in the chat (`lib/aztec/chat-agreements.ts`). |
| Message text and names of chat contacts | The dashboard reads counts only, so nothing personal is copied out of the chat. |
| Shields and unshields sent from another device before this one synced | Received payments are rebuilt from notes; these operations emit no private event. |
| Proving times | The wallet does not record them yet. |
| The PXE's own synced block number | `lib/aztec/wallet/client.ts` does not expose it; the dashboard shows when the notes last synced instead, and the node's latest and proven blocks. |
| Portal deposits and withdrawals | The portal is deployed nowhere (`docs/PORTAL.md`). |

## 7. Serviceability: what works, how it was checked, what was not

**Flow, end to end:** sign in → connect the account's wallet → open the private wallet → overview → filter and search activity, open a record, copy its hash, open it in the explorer → people → network → messaging (on request) → your data → close the wallet or remove its data. Tabs deep-link (`/dashboard#activity`; the example keeps `?example=1`).

| State | Handled by |
|---|---|
| Loading (code, session, wallet, model) | Plain text after 400 ms; numbered steps while the wallet opens |
| Error (wallet open, node, notes sync, Fee Juice, messaging, wipe) | Wallet: error screen with retry and details. Reads: live line and Network say "not answering" or "sync failed", the next try, the last value's age. Messaging and wipe: one line under the action |
| Reconnection | Offline and back, hidden and back, node back after failures: all read at once and the line returns to "read just now" |
| No data | One sentence per section ("No activity yet", "Nothing in the last 90 days", "No counterparties yet", "No token is set up on this network yet") |
| Lots of data | Activity is virtualized with measured rows; the model runs in a worker (10,000 records in 35 ms on a laptop, test bound 1.5 s); People shows the 500 most active |
| Another dashboard tab | A notice: the wallet runs in one tab at a time |

**Checked here:**

- Unit tests, run locally with a Vitest stand-in (no network to install packages): `live` 9, `real-data` 11, `visual-rules` 10, `privacy` 20, `model` 10, i18n `dashboard-coverage` 6 and the other five i18n suites. All pass.
- Type check of every dashboard file and test against the real internal types (`WalletSnapshot`, `PrivateWallet`, `DashModel`), with stand-in declarations for React, wagmi, AppKit, the virtualizer and Next.
- A headless Chrome run (Chrome 153) of the real components and CSS, bundled with stand-ins for the wallet, wagmi, AppKit, session and virtualizer: desktop 1280×900 and phone 390×844 (scale 2, touch), 25 scenarios (every gate screen, the example's six sections, an empty live account, a node that does not answer, a transaction in progress, Spanish and Chinese). No horizontal overflow, no element with an animation or transition, no page error. That run found and fixed three defects: link-buttons with invisible text (a CSS specificity clash), the overview overflowing a phone's width, and the NaN retry delay above.

**Not checked yet (limits):**

- Not tried on a physical iPhone or Android phone, nor as an installed PWA on one.
- Not run against a real Aztec Alpha wallet and node: the live sources call the wallet's real methods, but the run above used stand-ins.
- Not built with `next build` here, and not run against the real wagmi, AppKit and `@tanstack/react-virtual` (not installed in this environment); CI does both.
- Not measured on a mid-range phone.
- Screen readers not tried; the markup follows the ARIA tabs pattern, states use `role="status"`, errors `role="alert"`.

## 8. Languages

Every text is in English, Spanish, Russian, German and Chinese. `test/unit/i18n/dashboard-coverage.test.ts` reads every component in `components/dashboard/` (not a fixed list), the alert texts in `model.ts` and the ages in `live.ts`, and fails when a dictionary misses one.
