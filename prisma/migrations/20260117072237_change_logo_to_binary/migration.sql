/*
  Warnings:

  - You are about to drop the column `appLogo` on the `SystemSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SystemSettings" DROP COLUMN "appLogo",
ADD COLUMN     "appLogoData" BYTEA,
ADD COLUMN     "appLogoMimeType" TEXT;
