/*
  Warnings:

  - You are about to drop the column `accentColor` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `columns` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `language` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `theme` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `timezone` on the `Settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "accentColor",
DROP COLUMN "columns",
DROP COLUMN "language",
DROP COLUMN "theme",
DROP COLUMN "timezone";
