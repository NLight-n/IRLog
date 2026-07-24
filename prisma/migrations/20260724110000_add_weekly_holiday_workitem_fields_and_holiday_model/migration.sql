-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "weeklyHoliday" TEXT NOT NULL DEFAULT 'Sunday';

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN IF NOT EXISTS "appointmentTime" TEXT,
ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "notDoneReason" TEXT,
ADD COLUMN IF NOT EXISTS "patientAge" INTEGER,
ADD COLUMN IF NOT EXISTS "patientSex" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Scheduled';

ALTER TABLE "WorkItem" ALTER COLUMN "stage" SET DEFAULT 'Scheduled';

-- CreateTable
CREATE TABLE IF NOT EXISTS "Holiday" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Festival',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Holiday_date_key" ON "Holiday"("date");
