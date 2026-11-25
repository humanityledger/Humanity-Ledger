-- Migration: 20261125140000_community_successor
-- Purpose: legacy communities (posts stored by our server) are read-only; an admin can re-create
-- one on MLS and the old one points to the new one (lib/communities/legacy.ts,
-- docs/communities/LEGACY_READ_ONLY.md).
-- ADDITIVE ONLY. One new nullable column; nothing existing changes, nothing is deleted.

ALTER TABLE "Community" ADD COLUMN "successorId" TEXT;
