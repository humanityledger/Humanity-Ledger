-- Migration: 20261119150000_fee_juice_grants
-- Purpose: the record of Fee Juice grants to testers (package 5, OD-9, lib/alpha/fee-juice-grants.ts).
-- ADDITIVE ONLY. One new table; nothing existing changes.

CREATE TABLE "FeeJuiceGrant" (
    "id" TEXT NOT NULL,
    "recipientAztecAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "block" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketValueEur" TEXT NOT NULL,
    "valueSource" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "FeeJuiceGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeeJuiceGrant_txHash_key" ON "FeeJuiceGrant"("txHash");
