-- AlterTable: Add clerkId to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clerkId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkId_key" ON "User"("clerkId");
