-- Migration: 20261123160000_cusdc_beta_requests
-- Purpose: requests for a place in the closed cUSDC beta from /beta, and invitations reserved for
-- one wallet when the operator approves a request (docs/beta/CUSDC_BETA.md, "Requests").
-- ADDITIVE ONLY. One new table and one new nullable column; nothing existing changes.
-- Stores wallet addresses and dates only.

ALTER TABLE "CusdcBetaInvite" ADD COLUMN "reservedFor" TEXT;
CREATE UNIQUE INDEX "CusdcBetaInvite_reservedFor_key" ON "CusdcBetaInvite"("reservedFor");

CREATE TABLE "CusdcBetaRequest" (
    "walletAddress" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),

    CONSTRAINT "CusdcBetaRequest_pkey" PRIMARY KEY ("walletAddress")
);
