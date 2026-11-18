-- Migration: 20261118120000_chat_usernames
-- Purpose: Ledger Chat usernames and profile links (lib/chat/usernames.ts).
-- ADDITIVE ONLY. A new table; nothing existing changes.
-- The unique index on "username" is what makes a name unique in the world: a second account
-- saving the same name fails at the database, even when both try at the same instant.

CREATE TABLE "ChatUsername" (
    "walletAddress" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "linkToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatUsername_pkey" PRIMARY KEY ("walletAddress")
);

CREATE UNIQUE INDEX "ChatUsername_username_key" ON "ChatUsername"("username");
CREATE UNIQUE INDEX "ChatUsername_linkToken_key" ON "ChatUsername"("linkToken");
