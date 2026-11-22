-- Migration: 20261122150000_cusdc_beta
-- Purpose: the closed technical beta of private cUSDC payments, at most 100 members
-- (lib/beta/cusdc-beta.ts, docs/beta/CUSDC_BETA.md).
-- ADDITIVE ONLY. Two new tables; nothing existing changes. Only the HMAC of each code is stored.

CREATE TABLE "CusdcBetaInvite" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "redeemedBy" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "sanctionsCheckedAt" TIMESTAMP(3),
    "sanctionsListDate" TEXT,
    "sanctionsResult" TEXT,
    "adultCheckedAt" TIMESTAMP(3),

    CONSTRAINT "CusdcBetaInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CusdcBetaInvite_codeHash_key" ON "CusdcBetaInvite"("codeHash");
CREATE UNIQUE INDEX "CusdcBetaInvite_redeemedBy_key" ON "CusdcBetaInvite"("redeemedBy");

CREATE TABLE "CusdcBetaMember" (
    "walletAddress" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "noticeVersion" TEXT,
    "noticeAckAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CusdcBetaMember_pkey" PRIMARY KEY ("walletAddress")
);

CREATE UNIQUE INDEX "CusdcBetaMember_inviteId_key" ON "CusdcBetaMember"("inviteId");
