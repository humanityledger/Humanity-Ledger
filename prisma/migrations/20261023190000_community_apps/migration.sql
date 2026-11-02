-- CreateTable
CREATE TABLE "CommunityApp" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "creatorAddress" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'model',
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityAppEntry" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityAppEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityApp_communityId_status_idx" ON "CommunityApp"("communityId", "status");

-- CreateIndex
CREATE INDEX "CommunityApp_creatorAddress_idx" ON "CommunityApp"("creatorAddress");

-- CreateIndex
CREATE INDEX "CommunityAppEntry_appId_updatedAt_idx" ON "CommunityAppEntry"("appId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityAppEntry_appId_scope_key_key" ON "CommunityAppEntry"("appId", "scope", "key");

-- AddForeignKey
ALTER TABLE "CommunityApp" ADD CONSTRAINT "CommunityApp_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAppEntry" ADD CONSTRAINT "CommunityAppEntry_appId_fkey" FOREIGN KEY ("appId") REFERENCES "CommunityApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

