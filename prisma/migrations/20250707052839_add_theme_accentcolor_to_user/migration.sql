-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accentColor" TEXT DEFAULT '#3b82f6',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'light';
