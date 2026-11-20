-- AlterTable
ALTER TABLE "users" ADD COLUMN     "encryptedAccessToken" TEXT,
ADD COLUMN     "tokenIv" TEXT,
ADD COLUMN     "tokenTag" TEXT;
