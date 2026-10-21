# Migration Plan: DirectMessage & PendingChatMessage Deprecation

## Overview
Humanity Ledger enforces strict Zero-Knowledge and client-side encryption. Server-stored plaintext chat messages represent a catastrophic security liability.

## Execution Steps
1. **Notice Period**: 14-day banner alerting legacy users that unencrypted server direct messages will be deleted.
2. **Export Tool**: Users can export historical logs encrypted with their local session key.
3. **Table Drop**: Run SQL migration `DROP TABLE IF EXISTS "DirectMessage", "PendingChatMessage" CASCADE;`.
4. **Endpoint Behavior**: Legacy routes `/api/chat/direct` and `/api/chat/queue` permanently return HTTP 410 Gone.
5. **Modern Architecture**: All direct messages flow through XMTP client-side protocols.
