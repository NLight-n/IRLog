/*
  Warnings:

  - You are about to drop the `Settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Settings" DROP CONSTRAINT "Settings_userID_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "columns" JSONB;

-- DropTable
DROP TABLE "Settings";

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" SERIAL NOT NULL,
    "appHeading" TEXT NOT NULL DEFAULT 'Interventional Radiology',
    "appSubheading" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT '$',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '24hr',

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
