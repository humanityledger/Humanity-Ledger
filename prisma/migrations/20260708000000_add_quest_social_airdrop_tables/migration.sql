-- Migration: add_quest_social_airdrop_tables
-- Creates all tables needed for the QD quest reward system

-- AztecQuest: defines available quests
CREATE TABLE IF NOT EXISTS "AztecQuest" (
  "id"          TEXT      NOT NULL PRIMARY KEY,
  "slug"        TEXT      NOT NULL UNIQUE,
  "title"       TEXT      NOT NULL,
  "description" TEXT      NOT NULL,
  "qdReward"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN   NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- QuestClaim: tracks which wallets have claimed which quests (anti-double-claim)
CREATE TABLE IF NOT EXISTS "QuestClaim" (
  "id"           TEXT      NOT NULL PRIMARY KEY,
  "questId"      TEXT      NOT NULL,
  "aztecAddress" TEXT      NOT NULL,
  "ipHash"       TEXT      NOT NULL,
  "status"       TEXT      NOT NULL DEFAULT 'CLAIMED',
  "claimedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "slashedAt"    TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuestClaim_questId_aztecAddress_key" ON "QuestClaim"("questId","aztecAddress");
CREATE UNIQUE INDEX IF NOT EXISTS "QuestClaim_questId_ipHash_key" ON "QuestClaim"("questId","ipHash");
CREATE INDEX IF NOT EXISTS "QuestClaim_aztecAddress_status_idx" ON "QuestClaim"("aztecAddress","status");

-- AirdropClaim: tracks monthly airdrops (1st of month, 10 QDs)
CREATE TABLE IF NOT EXISTS "AirdropClaim" (
  "id"            TEXT      NOT NULL PRIMARY KEY,
  "walletAddress" TEXT      NOT NULL,
  "year"          INTEGER   NOT NULL,
  "month"         INTEGER   NOT NULL,
  "amount"        DOUBLE PRECISION NOT NULL DEFAULT 10.0,
  "txHash"        TEXT      UNIQUE,
  "claimedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AirdropClaim_walletAddress_year_month_key" ON "AirdropClaim"("walletAddress","year","month");
CREATE INDEX IF NOT EXISTS "AirdropClaim_walletAddress_idx" ON "AirdropClaim"("walletAddress");

-- SocialVerification: tracks social media follows per wallet
CREATE TABLE IF NOT EXISTS "SocialVerification" (
  "id"             TEXT      NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "walletAddress"  TEXT      NOT NULL UNIQUE,
  "twitterId"      TEXT,
  "twitterFollow"  BOOLEAN   NOT NULL DEFAULT false,
  "youtubeId"      TEXT,
  "youtubeFollow"  BOOLEAN   NOT NULL DEFAULT false,
  "telegramId"     TEXT,
  "telegramFollow" BOOLEAN   NOT NULL DEFAULT false,
  "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SocialVerification_walletAddress_idx" ON "SocialVerification"("walletAddress");

-- QdTransaction: detailed QD ledger entries
CREATE TABLE IF NOT EXISTS "QdTransaction" (
  "id"           TEXT      NOT NULL PRIMARY KEY,
  "aztecAddress" TEXT      NOT NULL,
  "type"         TEXT      NOT NULL,
  "amount"       DOUBLE PRECISION NOT NULL,
  "description"  TEXT      NOT NULL,
  "txHash"       TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "QdTransaction_aztecAddress_createdAt_idx" ON "QdTransaction"("aztecAddress","createdAt" DESC);
CREATE INDEX IF NOT EXISTS "QdTransaction_type_idx" ON "QdTransaction"("type");

-- Seed the 4 core quests
INSERT INTO "AztecQuest" ("id", "slug", "title", "description", "qdReward", "isActive")
VALUES
  ('quest-twitter-001', 'twitter-follow', 'Follow on X (Twitter)', 'Follow @WhaleNetwork on X to earn 50 QDs. Be part of the Aztec community.', 50, true),
  ('quest-youtube-001', 'youtube-follow', 'Subscribe on YouTube', 'Subscribe to Humanity Ledger on YouTube to earn 200 QDs.', 200, true),
  ('quest-tg-001', 'tg-join', 'Join Telegram Community', 'Join t.me/humanityledger on Telegram to earn 200 QDs.', 200, true),
  ('quest-share-001', 'page-share', 'Share ledgerchat.org', 'Share ledgerchat.org on your social networks to earn 15 QDs.', 15, true)
ON CONFLICT ("slug") DO NOTHING;
