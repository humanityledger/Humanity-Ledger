-- Migration: 20261117120000_community_post_pins
-- Purpose: a community post is pinned only when a person chooses Pin.
-- ADDITIVE ONLY. Both columns are nullable: every existing post stays unpinned.
-- Before this, the client asked for ?pinned=true, the server ignored it, and every post
-- appeared in the pinned list; PIN_MESSAGE / UNPIN_MESSAGE had no handler.

ALTER TABLE "CommunityPost" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "CommunityPost" ADD COLUMN "pinnedBy" TEXT;

CREATE INDEX "CommunityPost_communityId_pinnedAt_idx" ON "CommunityPost"("communityId", "pinnedAt");
