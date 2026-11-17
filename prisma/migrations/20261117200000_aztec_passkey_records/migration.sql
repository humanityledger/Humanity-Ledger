-- Migration: 20261117200000_aztec_passkey_records
-- Purpose: encrypted backup of passkey records for the private wallet (lib/aztec/wallet/passkey.ts).
-- ADDITIVE ONLY. A new table; nothing existing changes. Rows hold ciphertext the server cannot open.

CREATE TABLE "AztecPasskeyRecord" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "record" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AztecPasskeyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AztecPasskeyRecord_credentialId_key" ON "AztecPasskeyRecord"("credentialId");
CREATE INDEX "AztecPasskeyRecord_walletAddress_network_idx" ON "AztecPasskeyRecord"("walletAddress", "network");
