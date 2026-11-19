-- Migration: 20261119140000_alpha_admission
-- Purpose: closed alpha admission (package 4): the operator's sanctions and age checks on each
-- invitation, and the three separate acceptances of the signed terms on each tester, each with
-- its time and the SHA-256 of the accepted text. retainUntil = end of the alpha + 6 months;
-- scripts/alpha/purge.mjs deletes these fields after it.
-- ADDITIVE ONLY. Nullable columns; nothing existing changes.

ALTER TABLE "AlphaInvite" ADD COLUMN "sanctionsCheckedAt" TIMESTAMP(3);
ALTER TABLE "AlphaInvite" ADD COLUMN "sanctionsListDate" TEXT;
ALTER TABLE "AlphaInvite" ADD COLUMN "sanctionsResult" TEXT;
ALTER TABLE "AlphaInvite" ADD COLUMN "adultCheckedAt" TIMESTAMP(3);
ALTER TABLE "AlphaInvite" ADD COLUMN "retainUntil" TIMESTAMP(3);

ALTER TABLE "AlphaMember" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "AlphaMember" ADD COLUMN "termsSha256" TEXT;
ALTER TABLE "AlphaMember" ADD COLUMN "risksAcceptedAt" TIMESTAMP(3);
ALTER TABLE "AlphaMember" ADD COLUMN "risksSha256" TEXT;
ALTER TABLE "AlphaMember" ADD COLUMN "eligibilityAcceptedAt" TIMESTAMP(3);
ALTER TABLE "AlphaMember" ADD COLUMN "eligibilitySha256" TEXT;
ALTER TABLE "AlphaMember" ADD COLUMN "retainUntil" TIMESTAMP(3);
