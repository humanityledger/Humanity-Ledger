-- Migration: 20261120140000_status_media
-- Purpose: photo and video Status without an R2 bucket (app/api/chat/stories/media).
-- ADDITIVE ONLY. One new table; nothing existing changes. Rows expire with their status (24 h).

CREATE TABLE "StatusMedia" (
    "id" TEXT NOT NULL,
    "authorAddress" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StatusMedia_authorAddress_idx" ON "StatusMedia"("authorAddress");
CREATE INDEX "StatusMedia_expiresAt_idx" ON "StatusMedia"("expiresAt");
