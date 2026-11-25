-- Migration: 20261125220000_scale_3m_indexes
-- Additive only: ensures "StatusUpdate" exists without runtime DDL, adds missing lookup/TTL
-- indexes across high-volume tables (ChatContact.peer, User prefix search, SiweNonce, PendingChatMessage, DirectMessage).

CREATE TABLE IF NOT EXISTS "StatusUpdate" (
    "id" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "emoji" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'contacts',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StatusUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "User_chatName_idx" ON "User"("chatName");
CREATE INDEX IF NOT EXISTS "User_displayName_idx" ON "User"("displayName");
CREATE INDEX IF NOT EXISTS "ChatContact_peer_idx" ON "ChatContact"("peer");
CREATE INDEX IF NOT EXISTS "PendingChatMessage_createdAt_idx" ON "PendingChatMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "SiweNonce_expiresAt_idx" ON "SiweNonce"("expiresAt");
CREATE INDEX IF NOT EXISTS "StatusUpdate_ownerAddress_createdAt_idx" ON "StatusUpdate"("ownerAddress", "createdAt");
CREATE INDEX IF NOT EXISTS "StatusUpdate_privacy_expiresAt_idx" ON "StatusUpdate"("privacy", "expiresAt");
CREATE INDEX IF NOT EXISTS "StatusUpdate_expiresAt_idx" ON "StatusUpdate"("expiresAt");
CREATE INDEX IF NOT EXISTS "DirectMessage_createdAt_idx" ON "DirectMessage"("createdAt");
