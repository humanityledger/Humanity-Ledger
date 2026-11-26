-- Migration: 20261126120000_chat_block
-- Additive only: per-wallet block list enforced in both directions by
-- lib/chat/blockFirewall.ts (contact requests, presence, fallback messages,
-- queue, push, calls). Delete-chat never writes here.

CREATE TABLE IF NOT EXISTS "ChatBlock" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "blockedPeer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatBlock_owner_blockedPeer_key" ON "ChatBlock"("owner", "blockedPeer");
CREATE INDEX IF NOT EXISTS "ChatBlock_blockedPeer_owner_idx" ON "ChatBlock"("blockedPeer", "owner");
