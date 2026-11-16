# Signing in (/connect)

There are two ways in, and only two:

1. **A wallet** (SIWE, EIP-4361): the wallet signs a short message; `/api/siwe/verify` checks it and
   sets the session cookies. Signing is free and writes nothing on chain.
2. **A linked phone** (computers): scan the code with Ledger Chat on the phone, which holds the
   account (docs on linked devices: `lib/auth/linkedDevices.ts`).

Email sign-in was removed on 2026-11-11: the option, its modal and `/api/auth/send-code`,
`/api/auth/verify-code` and `/api/auth/check-email` are gone (410 at the edge). Sessions opened
earlier by email keep working until they expire.

## Wallet apps from Safari and Chrome

The default path stays in the visitor's own browser. The wallet app opens through WalletConnect (Reown AppKit),
approves, and the visitor comes back to the same tab. Nothing in /connect navigates by itself into a wallet's
in-app browser.

On Safari or Chrome (no injected wallet), /connect also shows **Open in MetaMask**. It is a link the person taps:
`https://link.metamask.io/dapp/ledgerchat.org`. The page does not assign that URL. It opens Ledger Chat inside
the MetaMask app, where `window.ethereum` is present and the same SIWE request can finish without a
WalletConnect round trip. If that signature fails, the failure screen shows the same link and says to sign
inside MetaMask, or to try again with WalletConnect in this browser. A wallet's own browser does not show the
link. Account derivation after SIWE is unchanged: the session is the address that signed.

- **iPhone (Safari)**: iOS 17 and later do not let a wallet switch back to the browser by itself.
  After approving, the visitor taps "‹ Safari" at the top left; /connect notices it is visible again
  and carries on. The page says so while it waits.
- **Android (Chrome)**: wallets return to the browser themselves after approving.
- **Computer**: browser extensions (MetaMask, Coinbase Wallet, Rainbow…) connect in the page; the
  "Other wallets" sheet shows a WalletConnect code for a phone wallet.
- The AppKit metadata has **no `redirect`**: that field is for native apps. A wallet following
  `redirect.universal` opens the site in a new tab, away from the one waiting for the approval.
- Cookies: the SIWE nonce and the session cookies are `HttpOnly; Secure; SameSite=None` in production
  (`app/api/siwe/nonce`, `app/api/siwe/verify`), kept from the iOS fix where Safari had dropped
  `Lax` cookies on the request made right after returning from the wallet. Cross-site requests are
  still refused by the middleware's CSRF check (Fetch Metadata, then Origin).

### The signature on iPhone (Safari, Chrome)

Every iOS browser is WebKit, and iOS suspends a tab as soon as another app comes to the front.
WalletConnect's `request()` sends the request to the relay and, at the same time, opens the wallet by
itself with the link AppKit stored when the wallet was picked (`WALLETCONNECT_DEEPLINK_CHOICE`), outside
any tap. Safari and Chrome followed that link before the request had left the page, so the wallet had
nothing to show and the request failed on return ("Failed to publish payload", shown as "The wallet did
not return the signature"). The Google app ignores such a link, which is why it signed.

On iPhone, outside a wallet's own browser, /connect therefore (`lib/auth/wc-sign-request.ts`):

1. holds back WalletConnect's own open for the sign-in request (the stored link is put back afterwards,
   also after a reload);
2. keeps "Open … to sign" on "Preparing the request" until the relay has acknowledged the request
   (`session_request_sent`), usually under a second, 8 s at most;
3. opens the wallet from the tap with WalletConnect's link to that request,
   `<wallet>://wc?requestId=…&sessionTopic=…` (an app scheme; a universal link opens in a new tab so
   this one keeps waiting);
4. does not count the time spent in the wallet against the sign-in timeout, and leaves 30 s on return
   for the relay to deliver the answer;
5. sends the request again only if the relay never took it while the page stayed in view; a request the
   wallet may be showing is never sent twice.

Android, computers, wallet browsers and One-Click Auth are unchanged.

### One trip to the wallet instead of two (opt-in)

Without it, a phone visitor goes to the wallet twice (connect, then sign) and on iPhone comes back by
hand twice. With `NEXT_PUBLIC_ONE_CLICK_AUTH=true` (build variable), phone browsers without an injected
wallet use AppKit's sign-in: the wallet connects and signs in one step where it supports it
(`wc_sessionAuthenticate`), otherwise both requests are made from the AppKit sheet. The signature goes
to the same `/api/siwe/verify`; /connect then only waits for that session, for that address, and does
not ask for a second signature. Desktop and wallet in-app browsers are unchanged.

It is off by default because it changes the main sign-in path and must be checked on real phones
first:

1. Deploy with `NEXT_PUBLIC_ONE_CLICK_AUTH=true` (Railway build variable).
2. iPhone, Safari, MetaMask app: /connect → MetaMask → approve (one request, or two in a row in the
   wallet) → "‹ Safari" → the chat opens. Repeat with Rainbow.
3. Android, Chrome, MetaMask and Coinbase Wallet: same, the wallet returns by itself.
4. Decline in the wallet: /connect shows "Try again" and a retry works.
5. If any step fails, remove the variable and redeploy: the two-step flow is back.

## Validation checklist (each on a real device)

| Device | Steps | Expected |
|---|---|---|
| iPhone, Safari | /connect → MetaMask → approve → "‹ Safari" → (sign) | Chat opens in the same Safari tab; no second tab |
| iPhone, Safari | same with Rainbow, Coinbase Wallet | same |
| iPhone, Chrome | /connect → MetaMask → approve → "‹ Chrome" → "Open MetaMask to sign" → sign → "‹ Chrome" | Chat opens; the wallet shows the signature request directly |
| iPhone, Safari | after "Open … to sign", stay in the wallet more than two minutes, then sign | Chat opens (no "expired") |
| Mac, Safari | /connect | Code for the phone; "Other wallets" shows a WalletConnect code |
| Android, Chrome | /connect → MetaMask → approve → sign | Returns to Chrome by itself; chat opens |
| Computer, Chrome | /connect → MetaMask extension → sign | Chat opens |
| Any | Look for an email option | None |
