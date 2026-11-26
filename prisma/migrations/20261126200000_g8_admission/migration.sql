-- Migration: 20261126200000_g8_admission (additive only)
CREATE TABLE IF NOT EXISTS "G8BlockedFingerprint" (
    "owner" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "G8BlockedFingerprint_pkey" PRIMARY KEY ("owner", "fingerprint")
);
CREATE TABLE IF NOT EXISTS "G8InviteRedemption" (
    "jti" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "redeemedBy" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "G8InviteRedemption_pkey" PRIMARY KEY ("jti")
);
CREATE INDEX IF NOT EXISTS "G8InviteRedemption_issuer_idx" ON "G8InviteRedemption"("issuer");
