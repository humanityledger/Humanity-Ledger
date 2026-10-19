-- AlterTable
ALTER TABLE "AuthUser" DROP COLUMN IF EXISTS "encryptedMnemonic",
DROP COLUMN IF EXISTS "walletSalt";
