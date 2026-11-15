-- Migration: 20261115230000_r17_mls_fields
-- Purpose: Add R-17 MLS fields to Community and CommunityChannel.
-- These fields are ADDITIVE ONLY. No existing data is modified or deleted.
-- Reference: docs/communities/MLS_MIGRATION.md
-- Schema source: prisma/schema.prisma lines 1637 (communityMls) and 1789 (xmtpGroupId)
--
-- communityMls: when true, all channels in this community use XMTP MLS groups.
--   The post endpoint returns 410 for migrated communities; content is not stored
--   on this server. Default false → no existing community is affected by this migration.
--
-- xmtpGroupId: XMTP MLS group ID for a CommunityChannel. Null until the community
--   enables the COMMUNITY_MLS flag and the channel owner creates the group via
--   lib/xmtp/groups.ts createSecureGroup(). Nullable → no existing channel is affected.
--
-- SAFETY: Both operations are non-destructive.
--   ADD COLUMN with DEFAULT on a Boolean: PostgreSQL fills existing rows with the
--   default value (false) without a table rewrite in PostgreSQL >= 11.
--   ADD COLUMN TEXT nullable: no default needed; existing rows get NULL.
--   CREATE INDEX: non-blocking if run outside a transaction (Railway applies migrations
--   inside a transaction by default; index creation is fast on an empty-or-small column).

-- Step 1: Add communityMls to Community
-- Existing rows → false (default). No behavior change until the flag is explicitly set.
ALTER TABLE "Community" ADD COLUMN "communityMls" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Add xmtpGroupId to CommunityChannel
-- Existing rows → NULL. No behavior change until the value is explicitly set.
ALTER TABLE "CommunityChannel" ADD COLUMN "xmtpGroupId" TEXT;

-- Step 3: Add index on xmtpGroupId (matches schema @@index([xmtpGroupId]))
CREATE INDEX "CommunityChannel_xmtpGroupId_idx" ON "CommunityChannel"("xmtpGroupId");
