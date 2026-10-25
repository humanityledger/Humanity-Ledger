-- CreateIndex
CREATE INDEX "CommunityPost_communityId_createdAt_idx" ON "CommunityPost"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_recipient_createdAt_idx" ON "DirectMessage"("recipient", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_sender_createdAt_idx" ON "DirectMessage"("sender", "createdAt");

