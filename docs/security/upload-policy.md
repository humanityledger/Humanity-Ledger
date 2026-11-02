# File Upload Security Policy

1. **Client-Side Encryption**: All private chat attachments are encrypted client-side using XMTP RemoteAttachment spec before upload.
2. **Magic Byte Verification**: Server enforces magic bytes inspection (preventing polyglots and executable masquerading).
3. **Size Limit**: Hard cap at 25 MB per attachment.
4. **No HTML Execution**: Uploaded media served exclusively with `Content-Type: application/octet-stream` or explicit sanitized MIME, and `Content-Disposition: attachment; filename="..."`, `X-Content-Type-Options: nosniff`.
5. **Isolated Storage**: Attachments stored in isolated bucket with random UUID filenames.
