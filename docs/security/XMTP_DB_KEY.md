# The signature asked when Ledger Chat opens

## What happens

Each time a tab opens Ledger Chat, the wallet is asked for one signature over a fixed message ("Ledger Chat: unlock my message database on this device", with the account and `hl/xmtp-db/v1`). Signing is free and sends nothing to a chain. From that signature the page derives, with HKDF-SHA256, the 32 byte key of the local XMTP database (`lib/xmtp/db-key.ts`, finding F-01). The key lives only in the memory of that tab and is wiped when the tab closes or the account signs out.

The signature is deterministic (RFC 6979), so the same wallet always produces the same key. A wallet whose signatures change every time (some smart contract wallets) is refused instead of creating a new, empty database.

## Why it cannot simply be removed

The key has to come from somewhere when the tab starts. There are three places it could come from:

| Source | Signature on open | What someone with this computer's disk gets |
|---|---|---|
| The wallet (today) | One per tab | Nothing: the key is never written down |
| The key kept by the browser (IndexedDB, as a non exportable WebCrypto key) | None | The browser profile holds what opens the database; anyone who copies the profile, or malware running as the user, can open it |
| The key written in plain text (before F-01) | None | The key itself |

Removing the signature therefore means storing the key, which is exactly what F-01 removed. The signature is the price of a database that cannot be opened from a copied browser profile.

## What would reduce it without weakening that

Sharing the key between tabs that are already open (in memory, over a BroadcastChannel of the same origin) would avoid a second signature when a second tab opens while the first is still open. It does not help a reload or a new session, and it adds a channel that must refuse keys for another account. It is not implemented yet.

## A product choice, if wanted

A "Remember this device" switch, off by default, could keep a non exportable key in IndexedDB so that device opens without a signature. It should be offered only with plain words about the trade off in the table above, it should never be on for a device the person marks as shared, and signing out must delete it. This needs a decision before it is built.

## What the person sees

1. Ledger Chat opens and the wallet shows the unlock message.
2. They sign; the chats appear.
3. If they decline, the chats stay locked until they sign. Nothing is created, and no other database replaces theirs.
