-- Migration: 20261118160000_closed_alpha
-- Purpose: closed alpha invitations and testers (lib/alpha/invites.ts, lib/alpha/gate.ts).
-- ADDITIVE ONLY. Two new tables; nothing existing changes. Only the HMAC of each code is stored.

CREATE TABLE "AlphaInvite" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "redeemedBy" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AlphaInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlphaInvite_codeHash_key" ON "AlphaInvite"("codeHash");
CREATE UNIQUE INDEX "AlphaInvite_redeemedBy_key" ON "AlphaInvite"("redeemedBy");

CREATE TABLE "AlphaMember" (
    "walletAddress" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskAckAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AlphaMember_pkey" PRIMARY KEY ("walletAddress")
);

CREATE UNIQUE INDEX "AlphaMember_inviteId_key" ON "AlphaMember"("inviteId");
