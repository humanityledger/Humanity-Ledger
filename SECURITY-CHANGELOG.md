# Security changelog

Every change with security impact, one line each, newest first. A line names what changed, where,
and what it protects. Fixes made before this file existed are in `CHANGELOG.md`.

## 2026-11-21

- `POST /api/user/profiles` returns only display name and photo, for at most 100 addresses, and
  needs a session, like `/api/user/search` (`app/api/user/profiles/route.ts`).
- Deleting a chat records a cut-off and a deletion time on the device and in the synced device
  state, so deleted messages are not shown again after a sync (`lib/chat/cleared-chats.ts`).
- The profile route answers 503 instead of success when the public profile could not be saved
  (`app/api/user/profile/route.ts`), so the app never says a photo is visible when it is not.
- Sign-in and device unlock show the exact message the wallet will sign, field by field, and warn
  when the website in a sign-in message is not the page in the address bar
  (`components/auth/SignaturePreview.tsx`). Protects against signing on a look-alike site.
- Call screens say "encrypted in transit" instead of "encrypted end to end", matching what
  DTLS-SRTP with a signalling server can claim (`components/chat/call/CallScreens.tsx`).
- Large files: each 16 MiB piece is bound to its position and to the number of pieces through
  AES-GCM associated data, and checked against its SHA-256 before decryption, so pieces cannot be
  reordered, repeated or dropped (`lib/chat/large-file.ts`). Large-file messages carry a key and
  are never previewed, moderated or copied as text (`lib/chat/remote-attachment.ts`).
- `security.txt` lists GitHub private vulnerability reporting first and points its policy to
  `/trust#disclosure`; the link to a page that did not exist was removed.
