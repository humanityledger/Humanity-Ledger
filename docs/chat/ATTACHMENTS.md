# Encrypted attachments in Ledger Chat

Voice notes, photos, videos and files are encrypted on the sender's device. Our server and the storage bucket hold only ciphertext; the key travels inside the XMTP message, which is end-to-end encrypted by MLS.

## Flow

1. **Encrypt (sender's browser, `lib/chat/remote-attachment.ts`).** Fresh 32-byte `secret` and `salt` and a 12-byte `nonce` are generated for every file. The key is `HKDF-SHA256(secret, salt, info = "")`, used for AES-256-GCM, and `contentDigest = SHA-256(ciphertext)`.
2. **Upload (`POST /api/chat/attachments`).** The browser sends only the ciphertext, as `application/octet-stream`. The route:
   - requires a signed-in wallet and is rate limited (30 per minute);
   - refuses bodies that start like a plain file (`422 plaintext_suspected`);
   - stores the object in R2 under a random 128-bit id and returns `{ url, contentDigest }`.

   The sender checks that the digest matches its own before sending.
3. **Message (XMTP text).** The message is `{"type":"hl.attachment","v":1,…}` with the kind, URL, digest, `secret`, `salt`, `nonce`, length, MIME type and file name.
4. **Receive (`components/chat/RemoteAttachmentBubble.tsx`).** The recipient's browser:
   - fetches `GET /api/chat/attachments/<id>`;
   - checks the length and digest, then decrypts (the GCM tag is checked);
   - checks the decrypted bytes with `lib/chat/file-sniff.ts`.

   The file is rendered inline only if the bytes really are audio, an image or a video of the kind claimed. Anything else, including SVG and HTML, is a download.

## Rules

- **The URL must be our own path** (`/api/chat/attachments/<32 hex>`). Otherwise a message could make the recipient's browser contact any host and reveal their IP address.
- **The message text is never shown.** Chat list, notifications, reply quotes and Copy show only a label ("Voice message", "Photo", the file name). The send path skips moderation and text transforms for these messages, and they are never written to the plain-text offline outbox.
- **Fallback when storage is down.** If R2 is not configured or unreachable, files up to 700 KB are sent inline in the XMTP message in the old format (`__AUDIO__data:…` / `[ATTACHMENT:…]`). They never reach our server. Larger files fail with a message instead of being dropped silently by the relay.

## Not wire compatible with other XMTP apps

The key derivation matches XMTP's `RemoteAttachment` content type. The envelope does not: XMTP's codec encrypts a protobuf `EncodedContent` and uses its own content type, and Ledger Chat sends text messages. Interoperating would need `@xmtp/content-type-remote-attachment` and a registered codec.

## Operations

- **Environment variables:** `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. The bucket should be private; there is no public URL.
- **Lifecycle:** add an R2 lifecycle rule that deletes `chat-attachments/` objects after 30 days.
- **Disappearing messages:** these remove the message from devices, not the ciphertext, which stays until the lifecycle rule deletes it. Without the key in the message, the ciphertext cannot be read.
- **Who can fetch:** any signed-in wallet can fetch an id. Ids are unguessable and the content is useless without the key; the server does not record who is in which conversation.

## Tests

`test/unit/chat/remote-attachment.test.ts` (17 tests) covers:

- round trip, fresh keys per file, and interoperability of the derivation;
- tampered, swapped and truncated ciphertext;
- URL and file-name validation, and SVG never treated as an image;
- the plaintext guard (2,000 random ciphertexts, none flagged);
- digest mismatch from the server, inline fallback, and re-encryption after a 422;
- the AWS SigV4 "GET Object" example vector for the R2 signer.
