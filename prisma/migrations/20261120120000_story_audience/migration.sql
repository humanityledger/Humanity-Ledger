-- Migration: 20261120120000_story_audience
-- Purpose: Status audience controls (components/chat/LedgerUpdatesTab.tsx, app/api/chat/stories).
-- ADDITIVE ONLY. One new column with a default; existing rows mean "every contact", as before.

ALTER TABLE "Story" ADD COLUMN "audience" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
