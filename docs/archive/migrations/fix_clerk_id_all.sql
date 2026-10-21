-- Add clerkId to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clerkId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkId_key" ON "User"("clerkId");

-- Add clerkId to AuthUser table
ALTER TABLE "AuthUser" ADD COLUMN IF NOT EXISTS "clerkId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "AuthUser_clerkId_key" ON "AuthUser"("clerkId");
